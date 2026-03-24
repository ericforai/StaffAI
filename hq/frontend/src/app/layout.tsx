import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '智能体指挥部 | The Agency HQ',
  description: '管理您的 AI 专家特遣队',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-[#0a0a0a] text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
