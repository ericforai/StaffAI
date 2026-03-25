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
    <html lang="zh-CN">
      <body 
        className="min-h-screen bg-slate-50 text-slate-950 antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}
