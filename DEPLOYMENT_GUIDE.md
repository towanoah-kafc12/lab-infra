# Lab Infra - デプロイメントガイド

このガイドでは、CDK プロジェクトの初期化からデプロイ、CI/CD パイプラインの実行まで、ステップバイステップで説明します。

## 📋 前提条件の確認

### 必要なツール

```bash
# Node.js バージョン確認
node --version
# 推奨: v18.x 以上

# npm バージョン確認
npm --version

# AWS CLI バージョン確認
aws --version
# 推奨: aws-cli/2.x 以上

# AWS認証情報の確認
aws sts get-caller-identity
```

### AWS 認証情報の設定

```bash
# AWS認証情報の設定（未設定の場合）
aws configure

# または環境変数で設定
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=ap-northeast-1
```

## 🚀 Step 1: プロジェクトの初期化

### 1.1 依存関係のインストール

```bash
# プロジェクトディレクトリに移動
cd lab-infra

# 依存関係のインストール
npm install

# インストール確認
npm list --depth=0
```

### 1.2 TypeScript のコンパイル

```bash
# TypeScriptコンパイル
npm run build

# コンパイル結果の確認
ls -la bin/*.js lib/*.js
```

### 1.3 CDK CLI のインストール

```bash
# CDK CLIのグローバルインストール
npm install -g aws-cdk@2.87.0

# バージョン確認
cdk --version
```

## 🏗️ Step 2: CDK Bootstrap

### 2.1 Bootstrap 実行

```bash
# CDK Bootstrap（初回のみ）
cdk bootstrap

# 特定のリージョンでBootstrap
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1
```

### 2.2 Bootstrap 確認

```bash
# CloudFormationスタックの確認
aws cloudformation describe-stacks --stack-name CDKToolkit

# S3バケットの確認
aws s3 ls | grep cdk
```

## 🔍 Step 3: CDK コードの検証

### 3.1 Synth の実行

```bash
# CloudFormationテンプレートの生成
npm run synth

# または
cdk synth --all
```

### 3.2 生成されたテンプレートの確認

```bash
# 生成されたファイルの確認
ls -la cdk.out/

# テンプレートの内容確認（例：NetworkStack）
cat cdk.out/LabInfraNetworkStack.template.json | jq .
```

### 3.3 差分の確認

```bash
# デプロイ前の差分確認
cdk diff LabInfraNetworkStack
cdk diff LabInfraFargateServiceStack
cdk diff LabInfraPipelineStack
```

## 🚢 Step 4: スタックのデプロイ

### 4.1 個別スタックのデプロイ

```bash
# 1. ネットワークスタックのデプロイ
cdk deploy LabInfraNetworkStack

# デプロイ確認
aws cloudformation describe-stacks --stack-name LabInfraNetworkStack

# 2. Fargateサービススタックのデプロイ
cdk deploy LabInfraFargateServiceStack

# 3. パイプラインスタックのデプロイ
cdk deploy LabInfraPipelineStack
```

### 4.2 全スタックの一括デプロイ

```bash
# 全スタックの一括デプロイ
npm run deploy

# または
cdk deploy --all
```

### 4.3 デプロイ結果の確認

```bash
# CloudFormationスタックの確認
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# 出力値の確認
aws cloudformation describe-stacks --stack-name LabInfraNetworkStack \
  --query 'Stacks[0].Outputs'

aws cloudformation describe-stacks --stack-name LabInfraFargateServiceStack \
  --query 'Stacks[0].Outputs'

aws cloudformation describe-stacks --stack-name LabInfraPipelineStack \
  --query 'Stacks[0].Outputs'
```

## 🔄 Step 5: CI/CD パイプラインの実行

### 5.1 ソースコードの準備

```bash
# プロジェクトルートで実行
# 不要なファイルを除外してZIP作成
zip -r source.zip . \
  -x "node_modules/*" \
  -x "cdk.out/*" \
  -x ".git/*" \
  -x "*.log" \
  -x ".aws/*" \
  -x "source.zip"

# ZIPファイルの確認
ls -lh source.zip
```

### 5.2 S3 バケット名の取得

```bash
# ソースバケット名を取得
SOURCE_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name LabInfraPipelineStack \
  --query 'Stacks[0].Outputs[?OutputKey==`SourceBucketName`].OutputValue' \
  --output text)

echo "Source Bucket: $SOURCE_BUCKET"
```

### 5.3 ソースコードのアップロード

```bash
# S3にソースコードをアップロード
aws s3 cp source.zip s3://$SOURCE_BUCKET/source.zip

# アップロード確認
aws s3 ls s3://$SOURCE_BUCKET/
```

### 5.4 パイプラインの実行

```bash
# パイプラインの手動実行
aws codepipeline start-pipeline-execution --name lab-infra-pipeline

# 実行状況の確認
aws codepipeline get-pipeline-state --name lab-infra-pipeline
```

### 5.5 パイプライン実行の監視

```bash
# パイプラインの実行履歴
aws codepipeline list-pipeline-executions --pipeline-name lab-infra-pipeline

# 特定の実行の詳細
EXECUTION_ID=$(aws codepipeline list-pipeline-executions \
  --pipeline-name lab-infra-pipeline \
  --query 'pipelineExecutionSummaries[0].pipelineExecutionId' \
  --output text)

aws codepipeline get-pipeline-execution \
  --pipeline-name lab-infra-pipeline \
  --pipeline-execution-id $EXECUTION_ID
```

### 5.6 CodeBuild ログの確認

```bash
# CodeBuildプロジェクトのビルド履歴
aws codebuild list-builds-for-project --project-name lab-infra-build

# 最新ビルドのログ確認
BUILD_ID=$(aws codebuild list-builds-for-project \
  --project-name lab-infra-build \
  --query 'ids[0]' --output text)

aws codebuild batch-get-builds --ids $BUILD_ID

# CloudWatch Logsでログ確認
aws logs describe-log-groups --log-group-name-prefix /aws/codebuild/lab-infra-build
```

## ✅ Step 6: デプロイ後の動作確認

### 6.1 ECS Fargate サービスの確認

```bash
# ECSクラスターの確認
aws ecs describe-clusters --clusters lab-infra-cluster

# サービスの状態確認
aws ecs describe-services \
  --cluster lab-infra-cluster \
  --services lab-infra-service

# 実行中のタスク一覧
aws ecs list-tasks \
  --cluster lab-infra-cluster \
  --service-name lab-infra-service
```

### 6.2 パブリック IP の取得

```bash
# タスクARNの取得
TASK_ARN=$(aws ecs list-tasks \
  --cluster lab-infra-cluster \
  --service-name lab-infra-service \
  --query 'taskArns[0]' --output text)

# タスクの詳細情報取得
aws ecs describe-tasks \
  --cluster lab-infra-cluster \
  --tasks $TASK_ARN

# パブリックIPの抽出
PUBLIC_IP=$(aws ecs describe-tasks \
  --cluster lab-infra-cluster \
  --tasks $TASK_ARN \
  --query 'tasks[0].attachments[0].details[?name==`publicIPv4Address`].value' \
  --output text)

echo "Public IP: $PUBLIC_IP"
```

### 6.3 アプリケーションへのアクセス

```bash
# HTTPアクセステスト
curl http://$PUBLIC_IP

# または
curl -I http://$PUBLIC_IP
```

### 6.4 ログの確認

```bash
# CloudWatch Logsグループの確認
aws logs describe-log-groups --log-group-name-prefix /aws/ecs/lab-infra

# ログストリームの確認
aws logs describe-log-streams --log-group-name /aws/ecs/lab-infra

# 最新ログの確認
LOG_STREAM=$(aws logs describe-log-streams \
  --log-group-name /aws/ecs/lab-infra \
  --order-by LastEventTime --descending \
  --query 'logStreams[0].logStreamName' --output text)

aws logs get-log-events \
  --log-group-name /aws/ecs/lab-infra \
  --log-stream-name "$LOG_STREAM" \
  --limit 50
```

## 🔧 Step 7: 運用コマンド

### 7.1 サービスのスケーリング

```bash
# タスク数を0に設定（停止）
aws ecs update-service \
  --cluster lab-infra-cluster \
  --service lab-infra-service \
  --desired-count 0

# タスク数を1に設定（再開）
aws ecs update-service \
  --cluster lab-infra-cluster \
  --service lab-infra-service \
  --desired-count 1

# タスク数を2に設定（スケールアウト）
aws ecs update-service \
  --cluster lab-infra-cluster \
  --service lab-infra-service \
  --desired-count 2
```

### 7.2 サービスの更新

```bash
# 新しいタスク定義でサービス更新
aws ecs update-service \
  --cluster lab-infra-cluster \
  --service lab-infra-service \
  --force-new-deployment
```

### 7.3 リソースの監視

```bash
# CPU/メモリ使用率の確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=lab-infra-service Name=ClusterName,Value=lab-infra-cluster \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

## 🧹 Step 8: クリーンアップ

### 8.1 段階的な削除

```bash
# 1. Fargateサービスのタスク数を0に設定
aws ecs update-service \
  --cluster lab-infra-cluster \
  --service lab-infra-service \
  --desired-count 0

# 2. サービスが停止するまで待機
aws ecs wait services-stable \
  --cluster lab-infra-cluster \
  --services lab-infra-service

# 3. スタックの削除（依存関係の逆順）
cdk destroy LabInfraPipelineStack
cdk destroy LabInfraFargateServiceStack
cdk destroy LabInfraNetworkStack
```

### 8.2 一括削除

```bash
# 全スタックの一括削除
npm run destroy

# または
cdk destroy --all
```

### 8.3 削除確認

```bash
# CloudFormationスタックの確認
aws cloudformation list-stacks \
  --stack-status-filter DELETE_COMPLETE

# S3バケットの確認（自動削除されているはず）
aws s3 ls | grep lab-infra
```

## 🐛 トラブルシューティング

### よくあるエラーと対処法

#### 1. Bootstrap エラー

```bash
# エラー: CDKToolkit stack doesn't exist
cdk bootstrap --force
```

#### 2. 権限エラー

```bash
# IAMユーザーの権限確認
aws iam get-user
aws iam list-attached-user-policies --user-name [USERNAME]
```

#### 3. Fargate 起動エラー

```bash
# ECSサービスのイベント確認
aws ecs describe-services \
  --cluster lab-infra-cluster \
  --services lab-infra-service \
  --query 'services[0].events'
```

#### 4. パイプライン実行エラー

```bash
# パイプライン実行の詳細確認
aws codepipeline get-pipeline-execution \
  --pipeline-name lab-infra-pipeline \
  --pipeline-execution-id [EXECUTION-ID]
```

### ログの確認方法

```bash
# CDKデプロイログ
cdk deploy --verbose 2>&1 | tee deploy.log

# CloudFormationイベント
aws cloudformation describe-stack-events \
  --stack-name [STACK-NAME] \
  --query 'StackEvents[?ResourceStatus!=`CREATE_IN_PROGRESS`]'
```

## 📊 コスト監視

### 月次コストの確認

```bash
# 現在の月の推定コスト
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

---

このガイドに従って実行することで、AWS CDK を使用した ECS Fargate サービスと CI/CD パイプラインの完全な学習環境を構築できます。
