// TypeScript: 複数のモジュールを一度にインポート
// 各行で異なるAWSサービスのライブラリを読み込み
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

/**
 * FargateServiceStackのプロパティ
 * 他のスタックからVPCを受け取るためのインターフェース
 */
// TypeScript: interface（インターフェース）でオブジェクトの型を定義
// Java のinterface と同じ概念だが、TypeScriptでは構造的型付け
// 「extends」で既存のインターフェースを拡張（Java と同じ）
interface FargateServiceStackProps extends cdk.StackProps {
  env?: cdk.Environment;
  vpc: ec2.Vpc; // プロパティの型を明示的に指定（必須プロパティ）
}

/**
 * Fargateサービススタック
 *
 * このスタックでは、コンテナ化されたアプリケーションを実行するための
 * Amazon ECS Fargateサービスを作成します：
 * - ECSクラスター: コンテナを実行するための論理的なグループ
 * - タスク定義: コンテナの設定（CPU、メモリ、イメージなど）
 * - Fargateサービス: 指定された数のタスクを継続的に実行
 * - セキュリティグループ: ネットワークアクセス制御
 */
export class FargateServiceStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: FargateServiceStackProps) {
    super(scope, id, props);

    /**
     * CloudWatch Logs グループの作成
     *
     * コンテナのログを収集・保存するためのロググループ
     * アプリケーションのデバッグやモニタリングに必要
     */
    // TypeScript: const で定数を宣言（Java の final と同様）
    // 型推論により logGroup の型は自動的に logs.LogGroup になる
    const logGroup = new logs.LogGroup(this, "LabInfraLogGroup", {
      logGroupName: "/aws/ecs/lab-infra",
      // ログの保持期間（日数）
      // 学習目的のため短期間に設定（コスト削減）
      retention: logs.RetentionDays.ONE_WEEK, // enum値
      // スタック削除時にロググループも削除
      removalPolicy: cdk.RemovalPolicy.DESTROY, // enum値
    });

    /**
     * ECSクラスターの作成
     *
     * ECSクラスターは、コンテナを実行するためのリソースの論理的なグループです。
     * Fargateを使用する場合、サーバーの管理は不要で、コンテナの実行に集中できます。
     */
    this.cluster = new ecs.Cluster(this, "LabInfraCluster", {
      clusterName: "lab-infra-cluster",
      // NetworkStackで作成したVPCを指定
      vpc: props.vpc,

      // Container Insightsの有効化（オプション）
      // コンテナレベルのメトリクスとログを収集（追加料金が発生する可能性）
      // 学習目的のため無効化
      containerInsights: false,
    });

    /**
     * タスク実行ロールの作成
     *
     * ECS Fargateがタスクを実行する際に必要なIAMロール
     * ECRからイメージをプル、CloudWatch Logsへの書き込み権限などを含む
     */
    // TypeScript: 変数名から型を推論（iam.Role型）
    const taskExecutionRole = new iam.Role(this, "LabInfraTaskExecutionRole", {
      roleName: "LabInfraTaskExecutionRole",
      // ECS Fargateサービスがこのロールを引き受けることを許可
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "ECS Fargate タスク実行用のIAMロール",
    });

    // TypeScript: メソッドチェーン（Java と同じ概念）
    // オブジェクトのメソッドを呼び出して設定を追加
    // AWSが管理するタスク実行用のポリシーをアタッチ
    // ECRアクセス、CloudWatch Logsへの書き込み権限などが含まれる
    taskExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AmazonECSTaskExecutionRolePolicy"
      )
    );

    /**
     * タスクロールの作成（オプション）
     *
     * コンテナ内のアプリケーションが他のAWSサービスにアクセスする際に使用
     * 現在は基本的な権限のみ設定
     */
    const taskRole = new iam.Role(this, "LabInfraTaskRole", {
      roleName: "LabInfraTaskRole",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "ECS Fargate タスク内のアプリケーション用のIAMロール",
    });

    /**
     * Fargateタスク定義の作成
     *
     * タスク定義は、コンテナの実行に必要な設定を定義します：
     * - 使用するCPUとメモリ
     * - コンテナイメージ
     * - ネットワーク設定
     * - ログ設定など
     */
    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "LabInfraTaskDefinition",
      {
        family: "lab-infra-task",

        // CPU設定（vCPU単位）
        // 256 = 0.25 vCPU（最小値）
        // 他の選択肢: 512 (0.5), 1024 (1.0), 2048 (2.0), 4096 (4.0)
        cpu: 256,

        // メモリ設定（MB単位）
        // CPUとメモリの組み合わせには制約があります
        // CPU 256の場合: 512MB, 1024MB, 2048MBが選択可能
        memoryLimitMiB: 512,

        // IAMロールの設定
        executionRole: taskExecutionRole, // タスク実行用（ECSサービスが使用）
        taskRole: taskRole, // アプリケーション用（コンテナ内から使用）
      }
    );

    /**
     * コンテナ定義の追加
     *
     * タスク定義にコンテナの詳細設定を追加します
     */
    // TypeScript: メソッドの戻り値を変数に代入
    // addContainer メソッドは ecs.ContainerDefinition 型を返す
    const container = taskDefinition.addContainer("LabInfraContainer", {
      containerName: "lab-infra-container",

      // 使用するDockerイメージ
      // amazon/amazon-ecs-sample は、AWSが提供する学習用のサンプルイメージ
      // シンプルなWebサーバーが含まれており、ポート80でHTTPリクエストに応答
      image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),

      // メモリ制限（MB単位）
      // タスク定義のメモリ制限内で設定
      memoryLimitMiB: 512, // number型

      // 必須コンテナかどうか
      // trueの場合、このコンテナが停止するとタスク全体が停止
      essential: true, // boolean型（Java と同じ）

      // ログ設定
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "lab-infra",
        logGroup: logGroup, // 上で定義した変数を参照
      }),

      // TypeScript: オブジェクトリテラルで環境変数を定義
      // key-value ペアの形式（Java の Map<String, String> に相当）
      environment: {
        APP_NAME: "LabInfra",
        ENVIRONMENT: "development",
      },
    });

    // TypeScript: 上で定義したcontainer変数のメソッドを呼び出し
    // void型のメソッド（戻り値なし、Java のvoidメソッドと同じ）
    // コンテナのポートマッピング設定
    // コンテナ内のポート80を外部に公開
    container.addPortMappings({
      containerPort: 80, // number型
      protocol: ecs.Protocol.TCP, // enum型
      name: "http", // string型
    });

    /**
     * セキュリティグループの作成
     *
     * Fargateサービスのネットワークアクセスを制御
     * ファイアウォールのような役割を果たす
     */
    const securityGroup = new ec2.SecurityGroup(this, "LabInfraSecurityGroup", {
      securityGroupName: "lab-infra-fargate-sg",
      vpc: props.vpc,
      description: "Lab Infra Fargate サービス用のセキュリティグループ",

      // アウトバウンド（送信）トラフィックをすべて許可
      // インターネットへのアクセスが必要な場合に設定
      allowAllOutbound: true,
    });

    // TypeScript: メソッドの引数に静的メソッドの結果を渡す
    // ec2.Peer.anyIpv4() = 静的メソッド呼び出し（Java の static メソッドと同じ）
    // インバウンド（受信）ルールの追加
    // ポート80（HTTP）への外部からのアクセスを許可
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(), // 送信元: 任意のIPアドレス（0.0.0.0/0）
      ec2.Port.tcp(80), // ポート: TCP 80番
      "HTTP traffic from anywhere" // ルールの説明
    );

    // HTTPS用のポート443も必要に応じて追加可能
    // securityGroup.addIngressRule(
    //   ec2.Peer.anyIpv4(),
    //   ec2.Port.tcp(443),
    //   'HTTPS traffic from anywhere'
    // );

    /**
     * Fargateサービスの作成
     *
     * 指定されたタスク定義を使用して、継続的にコンテナを実行するサービス
     * 高可用性とスケーラビリティを提供
     */
    this.service = new ecs.FargateService(this, "LabInfraService", {
      serviceName: "lab-infra-service",
      cluster: this.cluster, // 実行するクラスター
      taskDefinition: taskDefinition, // 使用するタスク定義

      // 希望するタスク数
      // 学習目的のため1つに設定（コスト削減）
      // 本格運用では2つ以上を推奨（高可用性のため）
      desiredCount: 1,

      // ネットワーク設定
      vpcSubnets: {
        // パブリックサブネットに配置
        // プライベートサブネットを使用する場合はNATゲートウェイが必要
        subnetType: ec2.SubnetType.PUBLIC,
      },

      // セキュリティグループの設定
      securityGroups: [securityGroup],

      // パブリックIPの自動割り当て
      // パブリックサブネットでインターネットアクセスを行う場合に必要
      assignPublicIp: true,

      // プラットフォームバージョン
      // 'LATEST'を指定すると最新バージョンを使用
      platformVersion: ecs.FargatePlatformVersion.LATEST,

      // サービスの更新設定
      // ローリングアップデート時の設定
      maxHealthyPercent: 200, // 更新中に実行可能なタスクの最大割合
      minHealthyPercent: 50, // 更新中に実行必須なタスクの最小割合

      // ヘルスチェック猶予期間（秒）
      // サービス開始後、ヘルスチェックを開始するまでの待機時間
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    /**
     * Auto Scaling設定（オプション）
     *
     * 負荷に応じてタスク数を自動調整
     * 学習目的のため現在はコメントアウト
     */
    /*
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: 1,  // 最小タスク数
      maxCapacity: 10, // 最大タスク数
    });

    // CPU使用率に基づくスケーリング
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70, // CPU使用率70%でスケールアウト
      scaleInCooldown: cdk.Duration.seconds(300),  // スケールイン間隔
      scaleOutCooldown: cdk.Duration.seconds(300), // スケールアウト間隔
    });
    */

    /**
     * CloudFormation出力
     *
     * 重要な情報を出力として定義し、外部から参照可能にする
     */
    new cdk.CfnOutput(this, "ClusterName", {
      value: this.cluster.clusterName,
      description: "ECSクラスター名",
      exportName: "LabInfra-ClusterName",
    });

    new cdk.CfnOutput(this, "ClusterArn", {
      value: this.cluster.clusterArn,
      description: "ECSクラスターのARN",
      exportName: "LabInfra-ClusterArn",
    });

    new cdk.CfnOutput(this, "ServiceName", {
      value: this.service.serviceName,
      description: "Fargateサービス名",
      exportName: "LabInfra-ServiceName",
    });

    new cdk.CfnOutput(this, "ServiceArn", {
      value: this.service.serviceArn,
      description: "FargateサービスのARN",
      exportName: "LabInfra-ServiceArn",
    });

    new cdk.CfnOutput(this, "TaskDefinitionArn", {
      value: taskDefinition.taskDefinitionArn,
      description: "タスク定義のARN",
      exportName: "LabInfra-TaskDefinitionArn",
    });

    new cdk.CfnOutput(this, "LogGroupName", {
      value: logGroup.logGroupName,
      description: "CloudWatch Logsグループ名",
      exportName: "LabInfra-LogGroupName",
    });
  }
}
