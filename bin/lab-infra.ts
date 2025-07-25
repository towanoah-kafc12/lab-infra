#!/usr/bin/env node
// TypeScript: 'source-map-support/register' をインポートしてデバッグ情報を改善
// コンパイル後のJavaScriptでエラーが発生した時に、元のTypeScriptの行番号を表示
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
// TypeScript: 相対パスでローカルモジュールをインポート
// '../lib/' = 上位ディレクトリのlibフォルダからインポート
// { } で名前付きインポート（クラス名を明示的に指定）
import { NetworkStack } from "../lib/network-stack";
import { FargateServiceStack } from "../lib/fargate-service-stack";
import { PipelineStack } from "../lib/pipeline-stack";

/**
 * AWS CDK学習用ラボプロジェクト
 *
 * このプロジェクトでは以下の3つのスタックを作成します：
 * 1. NetworkStack: VPCとサブネットの基盤ネットワーク
 * 2. FargateServiceStack: ECS Fargateサービス
 * 3. PipelineStack: CI/CDパイプライン
 */

// TypeScript: constで定数を宣言、newでインスタンス作成
// cdk.App = CDKアプリケーションのルートオブジェクト
const app = new cdk.App();

// TypeScript: オブジェクトリテラルで設定オブジェクトを作成
// process.env = Node.jsの環境変数オブジェクト
// || 演算子 = 左辺がfalsyなら右辺を使用（Javaの?:演算子と同様）
// 環境設定（リージョンとアカウントIDを指定）
// 実際の使用時は、環境変数やCDK contextから取得することを推奨
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT, // string | undefined型
  region: process.env.CDK_DEFAULT_REGION || "ap-northeast-1", // string型
};

// TypeScript: コンストラクタの引数でオブジェクトリテラルを使用
// env, = プロパティの省略記法（env: env と同じ意味）
// 1. ネットワークスタック（VPC、サブネット）を作成
// 他のスタックの基盤となるネットワークリソースを定義
const networkStack = new NetworkStack(app, "LabInfraNetworkStack", {
  env, // 上で定義した環境設定オブジェクトを参照
  description: "学習用ラボ - ネットワーク基盤スタック（VPC、サブネット）",
});

// TypeScript: カスタムインターフェースを使用したコンストラクタ
// vpc: networkStack.vpc = 他のスタックのpublicプロパティを参照
// 2. Fargateサービススタック（ECSクラスター、タスク定義、サービス）を作成
// NetworkStackで作成したVPCを参照して、ECSリソースを構築
const fargateServiceStack = new FargateServiceStack(
  app,
  "LabInfraFargateServiceStack",
  {
    env,
    description: "学習用ラボ - ECS Fargateサービススタック",
    // NetworkStackで作成したVPCを参照するための依存関係を設定
    vpc: networkStack.vpc, // 上で作成したスタックのプロパティを参照
  }
);

// 3. CI/CDパイプラインスタック（CodePipeline、CodeBuild）を作成
// 上記で作成したスタックをデプロイするためのパイプラインを構築
const pipelineStack = new PipelineStack(app, "LabInfraPipelineStack", {
  env,
  description: "学習用ラボ - CI/CDパイプラインスタック",
});

// TypeScript: メソッドチェーンで依存関係を設定
// addDependencyメソッドは戻り値なし（void）
// スタック間の依存関係を明示的に設定
// FargateServiceStackはNetworkStackに依存
fargateServiceStack.addDependency(networkStack);

// TypeScript: 静的メソッドチェーンでタグを設定
// cdk.Tags.of(app) = 静的メソッドでTagsオブジェクトを取得
// .add() = メソッドチェーンでタグを追加
// タグ付け（コスト管理と学習目的の明確化）
// 全てのリソースに共通のタグを付与
cdk.Tags.of(app).add("Project", "LabInfra"); // (key: string, value: string)
cdk.Tags.of(app).add("Purpose", "Learning");
cdk.Tags.of(app).add("Environment", "Development");
