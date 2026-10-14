import React from 'react';
import Link from 'next/link';

interface MockBannerProps {
  scenarioTitle: string;
  revision: number;
}

export const MockBanner: React.FC<MockBannerProps> = ({ scenarioTitle, revision }) => {
  return (
    <header
      role="banner"
      style={{
        backgroundColor: '#fff8e6',
        borderBottom: '2px solid #e0a800',
        padding: '10px 16px',
        color: '#4a3b00',
        fontSize: '13px',
        lineHeight: 1.5,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          maxWidth: '1400px',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span
            style={{
              backgroundColor: '#d97706',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              letterSpacing: '0.5px',
            }}
          >
            固定データ画面モック (Phase 1)
          </span>
          <strong>【外部非接続プレビュー】</strong>
          <span>
            実API・LLM・Mapbox等への外部接続はなく、全データは固定の架空サンプルです（認証・課金・個人情報収集なし）。
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span
            style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            Revision: {revision}
          </span>
          <Link href="/">
            <a
              style={{
                color: '#1d4ed8',
                textDecoration: 'underline',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              &larr; 従来のプロトタイプ画面に戻る
            </a>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default MockBanner;
