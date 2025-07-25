// TypeScript: import文でモジュールを読み込み（Javaのimportと同様）
// 「* as cdk」= aws-cdk-libの全てをcdkという名前でインポート
// 「{ Construct }」= constructsモジュールからConstructクラスのみをインポート（名前付きインポート）
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

/**
 * ネットワークスタック
 *
 * このスタックでは、アプリケーションの基盤となるネットワークリソースを作成します：
 * - VPC (Virtual Private Cloud): プライベートなクラウドネットワーク環境
 * - パブリックサブネット: インターネットからアクセス可能なサブネット
 * - プライベートサブネット: 内部通信専用のサブネット（将来の拡張用）
 * - インターネットゲートウェイ: VPCとインターネット間の通信を可能にする
 */
// TypeScript: 「export」でクラスを他のファイルから使用可能にする（Javaのpublicクラスと同様）
// 「extends」で継承（Javaと同じ概念）
export class NetworkStack extends cdk.Stack {
  // TypeScript: プロパティの型宣言（: ec2.Vpc）
  // 「public」= 外部からアクセス可能（Javaと同じ）
  // 「readonly」= 一度設定したら変更不可（Javaのfinalと同様）
  // 他のスタックから参照できるようにVPCをpublicプロパティとして公開
  public readonly vpc: ec2.Vpc;

  // TypeScript: コンストラクタ（Javaと同じ概念）
  // 引数の型を明示的に指定（scope: Construct, id: string）
  // 「props?」の「?」= オプショナル引数（nullableと同様、省略可能）
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // 親クラスのコンストラクタを呼び出し（Javaのsuper()と同じ）
    super(scope, id, props);

    /**
     * VPC (Virtual Private Cloud) の作成
     *
     * VPCは、AWSクラウド内に論理的に分離されたネットワーク環境を提供します。
     * ここでは学習目的のため、シンプルな構成で作成します。
     */
    // TypeScript: 「this」でインスタンス変数にアクセス（Javaと同じ）
    // 「new」でオブジェクト生成（Javaと同じ）
    // 第3引数は「オブジェクトリテラル」（{ key: value }の形式）
    this.vpc = new ec2.Vpc(this, "LabInfraVpc", {
      // CIDR（Classless Inter-Domain Routing）ブロック
      // 10.0.0.0/16 は、10.0.0.0 から 10.0.255.255 までの65,536個のIPアドレスを提供
      // /16 はサブネットマスクを表し、最初の16ビットがネットワーク部分を示す
      cidr: "10.0.0.0/16",

      // 最大アベイラビリティゾーン数
      // 高可用性のため、複数のAZにリソースを分散配置
      // 2つのAZを使用することで、1つのAZに障害が発生しても継続稼働可能
      maxAzs: 2,

      // サブネット構成の定義
      // パブリックサブネットとプライベートサブネットを各AZに作成
      // TypeScript: 配列リテラル [ ] でオブジェクトの配列を定義
      // Javaの ArrayList<Object> に相当
      subnetConfiguration: [
        {
          // TypeScript: オブジェクトリテラル（Javaの匿名クラスやMapに近い）
          // key: value の形式でプロパティを定義
          // パブリックサブネット: インターネットからアクセス可能
          // Webサーバーやロードバランサーなど、外部からアクセスが必要なリソース用
          cidrMask: 24, // number型（Javaのintと同様）
          name: "PublicSubnet", // string型（JavaのStringと同様）
          subnetType: ec2.SubnetType.PUBLIC, // enum型（Javaのenumと同様）
        },
        {
          // プライベートサブネット: 内部通信専用（将来の拡張用）
          // データベースやアプリケーションサーバーなど、直接インターネットアクセスが不要なリソース用
          // 現在はNATゲートウェイを使用しないため、実質的にはインターネットアクセス不可
          cidrMask: 24,
          name: "PrivateSubnet",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // NATゲートウェイなしのプライベートサブネット
        },
      ],

      // NATゲートウェイの設定
      // 学習目的とコスト削減のため、NATゲートウェイは作成しない
      // NATゲートウェイは時間課金（約$45/月）のため、本格運用時のみ使用を検討
      natGateways: 0,

      // インターネットゲートウェイの自動作成を有効化（デフォルトでtrue）
      // パブリックサブネットがインターネットと通信するために必要
      // createInternetGateway: true, // デフォルト値のため省略可能
    });

    /**
     * VPCフローログの設定（オプション）
     *
     * 学習目的でネットワークトラフィックを監視したい場合に有効化
     * 現在はコメントアウトしているが、必要に応じて有効化可能
     */
    /*
    new ec2.FlowLog(this, 'LabInfraVpcFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs('VpcFlowLogGroup'),
      trafficType: ec2.FlowLogTrafficType.ALL, // 全てのトラフィック（ACCEPT、REJECT、ALL）
    });
    */

    /**
     * CloudFormation出力
     *
     * 他のスタックや外部から参照できるように、重要な値を出力として定義
     * AWS CLIやコンソールから確認可能
     */
    new cdk.CfnOutput(this, "VpcId", {
      value: this.vpc.vpcId,
      description: "作成されたVPCのID",
      exportName: "LabInfra-VpcId", // 他のスタックからImportValue関数で参照可能
    });

    new cdk.CfnOutput(this, "VpcCidr", {
      value: this.vpc.vpcCidrBlock,
      description: "VPCのCIDRブロック",
      exportName: "LabInfra-VpcCidr",
    });

    // TypeScript: 配列のforEachメソッド（Javaのfor-eachループやStreamのforEachと同様）
    // 「(subnet, index) => { }」= アロー関数（Javaのラムダ式 (subnet, index) -> { } と同様）
    // パブリックサブネットIDの出力
    this.vpc.publicSubnets.forEach((subnet, index) => {
      // TypeScript: テンプレートリテラル `${}` で文字列に変数を埋め込み
      // Javaの String.format() や + 演算子での文字列結合と同様
      new cdk.CfnOutput(this, `PublicSubnet${index + 1}Id`, {
        value: subnet.subnetId,
        description: `パブリックサブネット${index + 1}のID (AZ: ${
          subnet.availabilityZone
        })`,
        exportName: `LabInfra-PublicSubnet${index + 1}Id`,
      });
    });

    // プライベートサブネットIDの出力
    this.vpc.isolatedSubnets.forEach((subnet, index) => {
      new cdk.CfnOutput(this, `PrivateSubnet${index + 1}Id`, {
        value: subnet.subnetId,
        description: `プライベートサブネット${index + 1}のID (AZ: ${
          subnet.availabilityZone
        })`,
        exportName: `LabInfra-PrivateSubnet${index + 1}Id`,
      });
    });
  }
}
