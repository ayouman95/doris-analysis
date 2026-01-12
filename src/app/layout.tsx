import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import StyledComponentsRegistry from '@/lib/AntdRegistry';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Doris Analysis Dashboard',
  description: 'Analytics Dashboard for Doris Data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StyledComponentsRegistry>
          <ConfigProvider locale={zhCN}>
            {children}
          </ConfigProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
