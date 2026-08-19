// app/h/[property_id]/operations/maintenance/_components/CaptureForm.tsx
// Extracted from ops/maintenance/page.tsx for slice 5 deep-link routes
"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = { id: number; category_name: string; category_code: string };
type Location = { id: number; location_name: string; location_type: string };

type CaptureFormProps = {
  propertyId: number;
  categories: Category[];
  locations: Location[];
  onSuccess?: () => void;
};

export default function CaptureForm({ propertyId, categories, locations, onSuccess }: CaptureFormProps) {
  const [captureForm, setCaptureForm] = useState({ 
    code: "", 
    name: "", 
    category: 16, 
    location: "", 
    manufacturer: "", 
    model: "", 
    serial: "", 
    notes: "", 
    photoUrl: "" 
  });
  const [uploading, setUploading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      alert("Camera access denied or unavailable. Use file upload instead.");
    }
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
    stopCamera();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleCapture() {
    if (!captureForm.code || !captureForm.name) {
      alert("Asset code and name are required");
      return;
    }
    setUploading(true);
    try {
      const sb = createClient();
      const { data, error } = await sb.rpc("fn_create_fixed_asset", {
        p_property_id: propertyId,
        p_asset_code: captureForm.code,
        p_asset_name: captureForm.name,
        p_category_id: captureForm.category,
        p_location_id: captureForm.location ? Number(captureForm.location) : null,
        p_manufacturer: captureForm.manufacturer || null,
        p_model: captureForm.model || null,
        p_serial_number: captureForm.serial || null,
        p_notes: captureForm.notes || null
      });
      if (error) throw error;
      alert(`✅ Asset ${captureForm.code} created!`);
      setCaptureForm({ code: "", name: "", category: 16, location: "", manufacturer: "", model: "", serial: "", notes: "", photoUrl: "" });
      setCapturedImage("");
      if (onSuccess) onSuccess();
    } catch (e: any) {
      alert("❌ " + e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Capture New Asset</h2>
        
        {/* Photo capture section */}
        <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
          <h3 className="font-semibold mb-3">📸 Photo (Optional)</h3>
          
          {!capturedImage && !cameraActive && (
            <div className="space-y-2">
              <button onClick={startCamera} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                📷 Open Camera
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-700">
                📁 Upload Photo
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </div>
          )}

          {cameraActive && (
            <div className="space-y-2">
              <video ref={videoRef} className="w-full rounded border border-gray-300" autoPlay playsInline />
              <div className="flex gap-2">
                <button onClick={capturePhoto} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700">
                  ✓ Capture
                </button>
                <button onClick={stopCamera} className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700">
                  ✕ Cancel
                </button>
              </div>
            </div>
          )}

          {capturedImage && (
            <div className="space-y-2">
              <img src={capturedImage} alt="Captured" className="w-full rounded border border-gray-300" />
              <button onClick={() => setCapturedImage("")} className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700">
                🗑 Remove
              </button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asset Code *</label>
            <input 
              type="text" 
              value={captureForm.code} 
              onChange={e => setCaptureForm({...captureForm, code: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="e.g. AC-101"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name *</label>
            <input 
              type="text" 
              value={captureForm.name} 
              onChange={e => setCaptureForm({...captureForm, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="e.g. Split AC Unit - Lobby"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select 
              value={captureForm.category} 
              onChange={e => setCaptureForm({...captureForm, category: Number(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.category_name} ({cat.category_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select 
              value={captureForm.location} 
              onChange={e => setCaptureForm({...captureForm, location: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">Select location...</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.location_name} ({loc.location_type})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
              <input 
                type="text" 
                value={captureForm.manufacturer} 
                onChange={e => setCaptureForm({...captureForm, manufacturer: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input 
                type="text" 
                value={captureForm.model} 
                onChange={e => setCaptureForm({...captureForm, model: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
            <input 
              type="text" 
              value={captureForm.serial} 
              onChange={e => setCaptureForm({...captureForm, serial: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea 
              value={captureForm.notes} 
              onChange={e => setCaptureForm({...captureForm, notes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              rows={3}
              placeholder="Installation date, warranty, special instructions..."
            />
          </div>

          <button 
            onClick={handleCapture}
            disabled={uploading || !captureForm.code || !captureForm.name}
            className="w-full bg-green-600 text-white py-3 rounded font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {uploading ? "Creating..." : "✓ Create Asset"}
          </button>
        </div>
      </div>
    </div>
  );
}
