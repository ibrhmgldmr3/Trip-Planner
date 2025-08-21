import { NextResponse } from 'next/server';

export interface HealthCheckResponse {
    status: 'ok' | 'error';
    timestamp: string;
    version?: string;
    environment?: string;
}

// Bu fonksiyonu artık export etmiyoruz, sadece dahili olarak kullanıyoruz
async function getHealthStatus(): Promise<HealthCheckResponse> {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV
    };
}

// GET isteği işleyicisi
export async function GET() {
    const healthData = await getHealthStatus();
    
    return NextResponse.json(healthData, {
        status: healthData.status === 'ok' ? 200 : 500,
        headers: {
            'Cache-Control': 'no-store, max-age=0',
        },
    });
}