export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getUserStats } from '@/app/actions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    const stats = await getUserStats(address);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get user stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
