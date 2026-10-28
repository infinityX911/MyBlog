// app/(blog)/api/downloads/[id]/download/route.ts
// GET /api/downloads/[id]/download
// → increments download_count → redirects to actual file URL

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    const id = Number(rawId)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const download = await prisma.download.findFirst({
      where: { id, status: 'published' },
      select: { fileUrl: true },
    })

    if (!download) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    prisma.download.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    }).catch(() => {})

    return NextResponse.redirect(download.fileUrl)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}