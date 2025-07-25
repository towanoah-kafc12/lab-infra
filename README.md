# Lab Infra - CDK 学習用プロジェクト

このプロジェクトは、AWS Cloud Development Kit (CDK) を使用して AWS インフラストラクチャと CI/CD パイプラインを学習するためのサンプルプロジェクトです。

## 📋 プロジェクト概要

### 構築される AWS リソース

1. **ネットワークスタック (NetworkStack)**

   - VPC (10.0.0.0/16)
   - パブリックサブネット × 2 (各 AZ)
   - プライベートサブネット × 2 (各 AZ)
   - インターネットゲートウェイ

2. **Fargate サービススタック (FargateServiceStack)**

   - ECS クラスター
   - Fargate タスク定義 (CPU: 256, Memory: 512MB)
   - Fargate サービス (amazon/amazon-ecs-sample イメージ)
   - セキュリティグループ
   - CloudWatch Logs

3. **CI/CD パイプラインスタック (PipelineStack)**
   - S3 バケット (ソースコード用)
   - CodeBuild プロジェクト (CDK synth)
   - CodePipeline (ビルド〜デプロイ自動化)

### 学習目標

- AWS CDK の基本的な使い方
- Infrastructure as Code (IaC) の概念
- Amazon ECS Fargate の理解
- CI/CD パイプラインの構築
- AWS リソース間の依存関係の管理

## 🚀 セットアップ手順

### 前提条件

- Node.js 18.x 以上
- AWS CLI v2
- AWS CDK CLI v2.87.0
- 適切な AWS 認証情報の設定

### 1. プロジェクトのセットアップ

```bash
# 依存関係のインストール
npm install

# TypeScriptのコンパイル
npm run build

# CDKの初期化（初回のみ）
cdk bootstrap
```

### 2. CDK コードの確認

```bash
# CloudFormationテンプレートの生成
npm run synth

# 生成されたテンプレートの確認
ls -la cdk.out/
```

### 3. スタックのデプロイ

```bash
# 全スタックのデプロイ
npm run deploy

# または個別にデプロイ
cdk deploy LabInfraNetworkStack
cdk deploy LabInfraFargateServiceStack
cdk deploy LabInfraPipelineStack
```

## 🔄 CI/CD パイプラインの使用方法

### パイプラインの手動実行

1. **ソースコードの準備**

   ```bash
   # プロジェクト全体をZIPファイルに圧縮
   zip -r source.zip . -x "node_modules/*" "cdk.out/*" ".git/*"
   ```

2. **S3 へのアップロード**

   ```bash
   # ソースバケット名を確認
   aws cloudformation describe-stacks --stack-name LabInfraPipelineStack \
     --query 'Stacks[0].Outputs[?OutputKey==`SourceBucketName`].OutputValue' --output text

   # ソースコードをアップロード
   aws s3 cp source.zip s3://[SourceBucketName]/source.zip
   ```

3. **パイプラインの実行**

   ```bash
   # パイプラインの手動実行
   aws codepipeline start-pipeline-execution --name lab-infra-pipeline

   # 実行状況の確認
   aws codepipeline get-pipeline-state --name lab-infra-pipeline
   ```

### パイプラインの監視

```bash
# パイプラインの実行履歴
aws codepipeline list-pipeline-executions --pipeline-name lab-infra-pipeline

# CodeBuildログの確認
aws logs describe-log-groups --log-group-name-prefix /aws/codebuild/lab-infra-build
```

## 🔍 デプロイ後の確認

### ECS Fargate サービスの確認

```bash
# ECSクラスターの確認
aws ecs list-clusters

# サービスの状態確認
aws ecs describe-services --cluster lab-infra-cluster --services lab-infra-service

# 実行中のタスク確認
aws ecs list-tasks --cluster lab-infra-cluster --service-name lab-infra-service

# タスクの詳細情報（パブリックIPの確認）
aws ecs describe-tasks --cluster lab-infra-cluster --tasks [TASK-ARN]
```

### アプリケーションへのアクセス

1. ECS タスクのパブリック IP を取得
2. ブラウザで `http://[PUBLIC-IP]` にアクセス
3. サンプルアプリケーションの動作を確認

### ログの確認

```bash
# CloudWatch Logsの確認
aws logs describe-log-streams --log-group-name /aws/ecs/lab-infra

# ログの内容確認
aws logs get-log-events --log-group-name /aws/ecs/lab-infra --log-stream-name [STREAM-NAME]
```

## 💰 コスト管理

### 推定月額コスト（東京リージョン）

- **ECS Fargate**: 約 $15-20/月

  - CPU (0.25 vCPU): $7.3/月
  - Memory (0.5 GB): $0.8/月
  - 実行時間による変動あり

- **VPC**: 無料

  - パブリック/プライベートサブネット: 無料
  - インターネットゲートウェイ: 無料

- **CloudWatch Logs**: 約 $0.5-2/月

  - ログ保存量による

- **S3**: 約 $0.1-1/月

  - ソースコードとアーティファクトの保存

- **CodePipeline/CodeBuild**: 実行時のみ課金
  - 月 1 回実行: 約 $1/月

**合計推定コスト**: 約 $17-25/月

### コスト削減のヒント

```bash
# 使用しない時はFargateサービスを停止
aws ecs update-service --cluster lab-infra-cluster --service lab-infra-service --desired-count 0

# 再開時
aws ecs update-service --cluster lab-infra-cluster --service lab-infra-service --desired-count 1

# 完全に削除する場合
npm run destroy
```

## 🧹 クリーンアップ

### 全リソースの削除

```bash
# 全スタックの削除
npm run destroy

# または個別に削除（依存関係の逆順）
cdk destroy LabInfraPipelineStack
cdk destroy LabInfraFargateServiceStack
cdk destroy LabInfraNetworkStack
```

### 手動削除が必要なリソース

- S3 バケット内のオブジェクト（自動削除設定済み）
- CloudWatch Logs のログストリーム（自動削除設定済み）

## 📚 学習リソース

### 関連ドキュメント

- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/)
- [Amazon ECS Developer Guide](https://docs.aws.amazon.com/ecs/)
- [AWS CodePipeline User Guide](https://docs.aws.amazon.com/codepipeline/)
- [AWS CodeBuild User Guide](https://docs.aws.amazon.com/codebuild/)

### 次のステップ

1. **Application Load Balancer の追加**

   - 複数のタスクへの負荷分散
   - ヘルスチェック機能

2. **Auto Scaling の実装**

   - CPU/メモリ使用率に基づく自動スケーリング

3. **RDS データベースの追加**

   - プライベートサブネットでのデータベース構築

4. **GitHub 連携**

   - GitHub Actions との連携
   - プルリクエストベースのデプロイ

5. **監視・アラート**
   - CloudWatch メトリクス
   - SNS 通知

## 🐛 トラブルシューティング

### よくある問題

1. **CDK Bootstrap エラー**

   ```bash
   cdk bootstrap aws://[ACCOUNT-ID]/[REGION]
   ```

2. **権限エラー**

   - IAM ユーザー/ロールに適切な権限があることを確認
   - AdministratorAccess ポリシーの一時的な付与を検討

3. **Fargate 起動エラー**

   - セキュリティグループの設定確認
   - サブネットの設定確認
   - タスク定義の設定確認

4. **パイプライン実行エラー**
   - CodeBuild ログの確認
   - IAM ロールの権限確認
   - S3 バケットのアクセス権限確認

### ログの確認方法

```bash
# CDKデプロイログ
cdk deploy --verbose

# CloudFormationイベント
aws cloudformation describe-stack-events --stack-name [STACK-NAME]

# ECSサービスイベント
aws ecs describe-services --cluster lab-infra-cluster --services lab-infra-service
```

## 📝 ライセンス

このプロジェクトは学習目的で作成されており、MIT ライセンスの下で公開されています。

## 🤝 コントリビューション

学習用プロジェクトのため、改善提案やバグ報告は歓迎します。

---

**注意**: このプロジェクトは学習目的で作成されており、本格的な本番環境での使用には追加のセキュリティ設定や最適化が必要です。
