"use client";
import dynamic from "next/dynamic";

// Map/Leaflet gibi sadece tarayıcıda çalışacak bileşenler için:
const MapView = dynamic(() => import("./MapView"), { ssr: false });
export default MapView;
