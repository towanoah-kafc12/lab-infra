// TypeScript: 長いモジュール名を短いエイリアスでインポート
// codepipeline_actions = ハイフンで区切ったモジュール名（TypeScriptでは一般的）
import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

/**
 * CI/CDパイプラインスタック
 *
 * このスタックでは、CDKアプリケーションを自動デプロイするための
 * CI/CDパイプラインを作成します：
 * - S3バケット: ソースコードとアーティファクトの保存
 * - CodeBuild: CDKプロジェクトのビルド（cdk synth）
 * - CodePipeline: ビルドからデプロイまでの自動化
 *
 * 学習目的のため、GitHubなどの外部リポジトリ連携は行わず、
 * 手動でS3にソースコードをアップロードする方式を採用
 */
export class PipelineStack extends cdk.Stack {
  // TypeScript: 複数のpublic readonlyプロパティを定義
  // 各プロパティの型を明示的に指定
  public readonly pipeline: codepipeline.Pipeline;
  public readonly sourceBucket: s3.Bucket;

  // TypeScript: オプショナル引数を使用（props?）
  // このスタックは他のスタックに依存しないため、カスタムprops不要
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * ソースコード用S3バケットの作成
     *
     * CDKプロジェクトのソースコードをZIPファイルでアップロードするためのバケット
     * 学習目的のため、手動アップロードを想定した設定
     */
    // TypeScript: this.プロパティ への代入
    // テンプレートリテラルで動的なバケット名を生成
    this.sourceBucket = new s3.Bucket(this, "LabInfraSourceBucket", {
      bucketName: `lab-infra-source-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      // cdk.Aws.ACCOUNT_ID = 静的プロパティでAWSアカウントIDを取得

      // TypeScript: boolean型のプロパティ
      // バージョニングの有効化
      // ソースコードの履歴管理とロールバック機能を提供
      versioned: true,

      // TypeScript: enum型のプロパティ
      // 暗号化設定
      // S3管理のキー（SSE-S3）を使用してデータを暗号化
      encryption: s3.BucketEncryption.S3_MANAGED,

      // パブリックアクセスのブロック
      // セキュリティのため、すべてのパブリックアクセスを禁止
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

      // スタック削除時の動作
      // 学習目的のため、スタック削除時にバケットも削除
      // 本格運用では RETAIN を推奨
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true, // バケット内のオブジェクトも自動削除
    });

    /**
     * アーティファクト用S3バケットの作成
     *
     * CodePipelineが中間生成物（アーティファクト）を保存するためのバケット
     * ビルド結果やデプロイ用ファイルなどが格納される
     */
    const artifactBucket = new s3.Bucket(this, "LabInfraArtifactBucket", {
      bucketName: `lab-infra-artifacts-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,

      // TypeScript: 配列リテラルでオブジェクトの配列を定義
      // ライフサイクルルールの設定
      // 古いアーティファクトを自動削除してストレージコストを削減
      lifecycleRules: [
        {
          id: "DeleteOldArtifacts", // string型
          enabled: true, // boolean型
          expiration: cdk.Duration.days(30), // Duration型（静的メソッドで生成）
        },
      ],
    });

    /**
     * CodeBuild用のIAMロール作成
     *
     * CodeBuildプロジェクトがCDKコマンドを実行するために必要な権限を定義
     */
    const codeBuildRole = new iam.Role(this, "LabInfraCodeBuildRole", {
      roleName: "LabInfraCodeBuildRole",
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
      description: "CDK ビルド用のCodeBuildサービスロール",
    });

    // TypeScript: メソッドの引数に new で作成したオブジェクトを直接渡す
    // CloudWatch Logsへの書き込み権限
    codeBuildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW, // enum型
        actions: [
          // stringの配列
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: [
          // stringの配列（テンプレートリテラル使用）
          `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/codebuild/*`,
        ],
      })
    );

    // S3バケットへのアクセス権限
    codeBuildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject"],
        resources: [
          this.sourceBucket.bucketArn + "/*",
          artifactBucket.bucketArn + "/*",
        ],
      })
    );

    // CDKデプロイに必要な権限（管理者権限）
    // 注意: 学習目的のため広範囲な権限を付与
    // 本格運用では最小権限の原則に従って必要な権限のみを付与
    codeBuildRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
    );

    /**
     * CodeBuildプロジェクトの作成
     *
     * CDKプロジェクトをビルド（cdk synth）し、CloudFormationテンプレートを生成
     */
    const buildProject = new codebuild.Project(this, "LabInfraBuildProject", {
      projectName: "lab-infra-build",
      description: "Lab Infra CDK プロジェクトのビルド",

      // 実行環境の設定
      environment: {
        // ビルド環境のイメージ
        // aws/codebuild/amazonlinux2-x86_64-standard:5.0 は Node.js 18 を含む
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,

        // コンピュートタイプ（CPU/メモリ）
        // SMALL: 3GB メモリ, 2 vCPU（最小構成、コスト削減）
        computeType: codebuild.ComputeType.SMALL,

        // 特権モードは不要（Dockerビルドを行わないため）
        privileged: false,
      },

      // IAMロールの設定
      role: codeBuildRole,

      // タイムアウト設定
      // CDKのsynthは通常数分で完了するため、短めに設定
      timeout: cdk.Duration.minutes(15),

      // ビルド仕様（buildspec.yml相当）
      // TypeScript: 静的メソッドでオブジェクトからBuildSpecを作成
      // ネストしたオブジェクトリテラルで複雑な設定を定義
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2", // string型

        // TypeScript: ネストしたオブジェクトリテラル
        // ビルドフェーズの定義
        phases: {
          // TypeScript: オブジェクトのプロパティとしてさらにオブジェクトをネスト
          // インストールフェーズ: 必要なツールのインストール
          install: {
            "runtime-versions": {
              // オブジェクトリテラル
              nodejs: "18", // string型
            },
            commands: [
              // stringの配列
              'echo "=== Installing dependencies ==="',
              "npm install -g aws-cdk@2.87.0", // CDK CLIのインストール
              "npm ci", // package-lock.jsonを使用した高速インストール
            ],
          },

          // ビルド前フェーズ: 環境確認
          pre_build: {
            commands: [
              'echo "=== Pre-build phase ==="',
              "node --version",
              "npm --version",
              "cdk --version",
              'echo "Current directory: $(pwd)"',
              "ls -la",
            ],
          },

          // メインビルドフェーズ: CDK synth実行
          build: {
            commands: [
              'echo "=== Build phase ==="',
              'echo "Running CDK synth..."',
              "cdk synth --all", // 全スタックのCloudFormationテンプレート生成
              'echo "CDK synth completed successfully"',
              "ls -la cdk.out/", // 生成されたファイルの確認
            ],
          },

          // ビルド後フェーズ: 結果の確認
          post_build: {
            commands: [
              'echo "=== Post-build phase ==="',
              'echo "Build completed at $(date)"',
            ],
          },
        },

        // TypeScript: オブジェクトのプロパティ名にハイフンが含まれる場合はクォートで囲む
        // アーティファクト（成果物）の設定
        artifacts: {
          // cdk.outディレクトリ内の全ファイルをアーティファクトとして出力
          files: [
            // stringの配列
            "**/*", // ワイルドカード文字列
          ],
          "base-directory": "cdk.out", // ハイフン含みのプロパティ名
        },

        // キャッシュ設定（オプション）
        // node_modulesをキャッシュしてビルド時間を短縮
        cache: {
          paths: ["node_modules/**/*"],
        },
      }),
    });

    /**
     * CodePipeline用のIAMロール作成
     */
    const pipelineRole = new iam.Role(this, "LabInfraPipelineRole", {
      roleName: "LabInfraPipelineRole",
      assumedBy: new iam.ServicePrincipal("codepipeline.amazonaws.com"),
      description: "CI/CDパイプライン用のサービスロール",
    });

    // S3バケットへのアクセス権限
    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
          "s3:GetBucketVersioning",
        ],
        resources: [
          this.sourceBucket.bucketArn,
          this.sourceBucket.bucketArn + "/*",
          artifactBucket.bucketArn,
          artifactBucket.bucketArn + "/*",
        ],
      })
    );

    // CodeBuildプロジェクトの実行権限
    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["codebuild:BatchGetBuilds", "codebuild:StartBuild"],
        resources: [buildProject.projectArn],
      })
    );

    // CloudFormationスタックのデプロイ権限
    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "cloudformation:CreateStack",
          "cloudformation:UpdateStack",
          "cloudformation:DeleteStack",
          "cloudformation:DescribeStacks",
          "cloudformation:DescribeStackEvents",
          "cloudformation:DescribeChangeSet",
          "cloudformation:CreateChangeSet",
          "cloudformation:DeleteChangeSet",
          "cloudformation:ExecuteChangeSet",
          "cloudformation:GetTemplate",
          "cloudformation:ValidateTemplate",
          "iam:PassRole",
        ],
        resources: ["*"], // CloudFormationは様々なリソースにアクセスするため
      })
    );

    /**
     * CodePipelineの作成
     *
     * ソースからデプロイまでの自動化されたワークフローを定義
     */
    this.pipeline = new codepipeline.Pipeline(this, "LabInfraPipeline", {
      pipelineName: "lab-infra-pipeline",
      role: pipelineRole,

      // アーティファクト保存用のS3バケット
      artifactBucket: artifactBucket,

      // パイプラインの再起動設定
      restartExecutionOnUpdate: true,
    });

    /**
     * パイプラインステージの定義
     */

    // TypeScript: constで定数を定義、型は推論される
    // アーティファクト定義
    const sourceOutput = new codepipeline.Artifact("SourceOutput");
    const buildOutput = new codepipeline.Artifact("BuildOutput");

    // TypeScript: this.pipelineプロパティのメソッドを呼び出し
    // オブジェクトリテラルで設定を渡す
    // 1. ソースステージ
    // S3バケットからソースコードを取得
    this.pipeline.addStage({
      stageName: "Source", // string型
      actions: [
        // アクションオブジェクトの配列
        new codepipeline_actions.S3SourceAction({
          actionName: "S3Source",
          bucket: this.sourceBucket, // 上で作成したバケットを参照
          bucketKey: "source.zip", // アップロードするZIPファイル名
          output: sourceOutput, // 上で定義したアーティファクトを参照

          // S3オブジェクトの変更を検知してパイプラインを自動実行
          // 手動実行の場合はfalseに設定可能
          trigger: codepipeline_actions.S3Trigger.POLL, // enum型
        }),
      ],
    });

    // 2. ビルドステージ
    // CDK synthを実行してCloudFormationテンプレートを生成
    this.pipeline.addStage({
      stageName: "Build",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "CDKSynth",
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    // 3. デプロイステージ
    // 生成されたCloudFormationテンプレートを使用してスタックをデプロイ
    this.pipeline.addStage({
      stageName: "Deploy",
      actions: [
        // NetworkStackのデプロイ
        new codepipeline_actions.CloudFormationCreateUpdateStackAction({
          actionName: "DeployNetworkStack",
          stackName: "LabInfraNetworkStack",
          templatePath: buildOutput.atPath(
            "LabInfraNetworkStack.template.json"
          ),
          adminPermissions: true, // 管理者権限でデプロイ（学習目的）

          // デプロイ順序の制御（他のアクションと並列実行）
          runOrder: 1,
        }),

        // FargateServiceStackのデプロイ（NetworkStack完了後）
        new codepipeline_actions.CloudFormationCreateUpdateStackAction({
          actionName: "DeployFargateServiceStack",
          stackName: "LabInfraFargateServiceStack",
          templatePath: buildOutput.atPath(
            "LabInfraFargateServiceStack.template.json"
          ),
          adminPermissions: true,

          // NetworkStackの完了を待ってから実行
          runOrder: 2,
        }),
      ],
    });

    /**
     * CloudFormation出力
     */
    new cdk.CfnOutput(this, "PipelineName", {
      value: this.pipeline.pipelineName,
      description: "CodePipeline名",
      exportName: "LabInfra-PipelineName",
    });

    new cdk.CfnOutput(this, "PipelineArn", {
      value: this.pipeline.pipelineArn,
      description: "CodePipelineのARN",
      exportName: "LabInfra-PipelineArn",
    });

    new cdk.CfnOutput(this, "SourceBucketName", {
      value: this.sourceBucket.bucketName,
      description: "ソースコード用S3バケット名",
      exportName: "LabInfra-SourceBucketName",
    });

    new cdk.CfnOutput(this, "BuildProjectName", {
      value: buildProject.projectName,
      description: "CodeBuildプロジェクト名",
      exportName: "LabInfra-BuildProjectName",
    });

    /**
     * 使用方法の説明をコメントとして記載
     *
     * パイプラインの手動実行方法:
     *
     * 1. ソースコードの準備:
     *    - CDKプロジェクト全体をZIPファイルに圧縮
     *    - ファイル名を 'source.zip' にする
     *
     * 2. S3へのアップロード:
     *    aws s3 cp source.zip s3://[SourceBucketName]/source.zip
     *
     * 3. パイプラインの手動実行:
     *    aws codepipeline start-pipeline-execution --name lab-infra-pipeline
     *
     * 4. 実行状況の確認:
     *    aws codepipeline get-pipeline-state --name lab-infra-pipeline
     */
  }
}
