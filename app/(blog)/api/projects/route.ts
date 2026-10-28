import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const projects = await prisma.project.findMany({
            select: {
                id: true,
                projectName: true,
                projectCategory: true,
                projectScreenshot: true,
                projectLink: true,
            },
            orderBy: { id: 'asc' },
        });

        // Map Prisma camelCase fields back to original snake_case
        // so Tabs.tsx doesn't need any changes to field names
        const mapped = projects.map(p => ({
            id: p.id,
            Project_name: p.projectName,
            Project_category: p.projectCategory,
            Project_screenshot: p.projectScreenshot,
            Project_link: p.projectLink,
        }));

        return NextResponse.json(mapped);
    } catch (error) {
        console.error('Projects API error:', error);
        return NextResponse.json([], { status: 500 });
    }
}
