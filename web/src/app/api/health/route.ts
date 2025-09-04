import { NextResponse } from 'next/server';

export interface HealthCheckResponse {
    status: 'ok' | 'error';
    timestamp: string;
    version?: string;
    environment?: string;
}

// Bu fonksiyonu art�k export etmiyoruz, sadece dahili olarak kullan�yoruz
async function getHealthStatus(): Promise<HealthCheckResponse> {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV
    };
}

// GET iste�i i�leyicisi
export async function GET() {
    const healthData = await getHealthStatus();
    
    return NextResponse.json(healthData, {
        status: healthData.status === 'ok' ? 200 : 500,
        headers: {
            'Cache-Control': 'no-store, max-age=0',
        },
    });
}
