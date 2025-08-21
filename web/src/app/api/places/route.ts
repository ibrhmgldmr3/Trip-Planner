// Next.js API Routes için örnek
// filepath: src/app/api/places/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&keyword=${query}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching places:', error);
    return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
  }
}