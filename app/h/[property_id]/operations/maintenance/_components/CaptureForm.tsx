// app/h/[property_id]/operations/maintenance/_components/CaptureForm.tsx
// Extracted from ops/maintenance/page.tsx for slice 5 deep-link routes
// PM v3 slice 6 — design-system conformance: form primitives styled via var(--*)
// tokens, buttons via global .btn-primary / .btn-ghost, no emoji, no Tailwind
// color classes. Photo capture (camera + upload fallback) stays functional.
"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import * as S from "./pmStyles";

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
      alert(`Asset ${captureForm.code} created`);
      setCaptureForm({ code: "", name: "", category: 16, location: "", manufacturer: "", model: "", serial: "", notes: "", photoUrl: "" });
      setCapturedImage("");
      if (onSuccess) onSuccess();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  }

  const fieldLabel = { display: "block" as const, marginBottom: 4, fontWeight: 500, ...S.label };

  return (
    <div className="max-w-2xl mx-auto">
      <div style={{ ...S.card, padding: 24 }}>
        <h2 style={{ ...S.sectionTitle, marginBottom: 16 }}>Capture New Asset</h2>

        {/* Photo capture section */}
        <div className="mb-6" style={S.inset}>
          <h3 style={{ ...S.sectionTitle, fontSize: "var(--t-lg)", marginBottom: 12 }}>Photo (Optional)</h3>

          {!capturedImage && !cameraActive && (
            <div className="space-y-2">
              <button onClick={startCamera} className="btn-primary w-full">
                Open Camera
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="btn-ghost w-full">
                Upload Photo
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </div>
          )}

          {cameraActive && (
            <div className="space-y-2">
              <video ref={videoRef} className="w-full" style={{ borderRadius: 6, border: "1px solid var(--hairline)" }} autoPlay playsInline />
              <div className="flex gap-2">
                <button onClick={capturePhoto} className="btn-primary flex-1">
                  Capture
                </button>
                <button onClick={stopCamera} className="btn-ghost flex-1">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {capturedImage && (
            <div className="space-y-2">
              <img src={capturedImage} alt="Captured" className="w-full" style={{ borderRadius: 6, border: "1px solid var(--hairline)" }} />
              <button onClick={() => setCapturedImage("")} className="btn-ghost w-full">
                Remove
              </button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <label style={fieldLabel}>Asset Code *</label>
            <input
              type="text"
              value={captureForm.code}
              onChange={e => setCaptureForm({...captureForm, code: e.target.value})}
              style={S.input}
              placeholder="e.g. AC-101"
              required
            />
          </div>

          <div>
            <label style={fieldLabel}>Asset Name *</label>
            <input
              type="text"
              value={captureForm.name}
              onChange={e => setCaptureForm({...captureForm, name: e.target.value})}
              style={S.input}
              placeholder="e.g. Split AC Unit - Lobby"
              required
            />
          </div>

          <div>
            <label style={fieldLabel}>Category *</label>
            <select
              value={captureForm.category}
              onChange={e => setCaptureForm({...captureForm, category: Number(e.target.value)})}
              style={S.input}
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.category_name} ({cat.category_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={fieldLabel}>Location</label>
            <select
              value={captureForm.location}
              onChange={e => setCaptureForm({...captureForm, location: e.target.value})}
              style={S.input}
            >
              <option value="">Select location...</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.location_name} ({loc.location_type})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={fieldLabel}>Manufacturer</label>
              <input
                type="text"
                value={captureForm.manufacturer}
                onChange={e => setCaptureForm({...captureForm, manufacturer: e.target.value})}
                style={S.input}
              />
            </div>
            <div>
              <label style={fieldLabel}>Model</label>
              <input
                type="text"
                value={captureForm.model}
                onChange={e => setCaptureForm({...captureForm, model: e.target.value})}
                style={S.input}
              />
            </div>
          </div>

          <div>
            <label style={fieldLabel}>Serial Number</label>
            <input
              type="text"
              value={captureForm.serial}
              onChange={e => setCaptureForm({...captureForm, serial: e.target.value})}
              style={S.input}
            />
          </div>

          <div>
            <label style={fieldLabel}>Notes</label>
            <textarea
              value={captureForm.notes}
              onChange={e => setCaptureForm({...captureForm, notes: e.target.value})}
              style={S.input}
              rows={3}
              placeholder="Installation date, warranty, special instructions..."
            />
          </div>

          <button
            onClick={handleCapture}
            disabled={uploading || !captureForm.code || !captureForm.name}
            className="btn-primary w-full"
            style={{ opacity: (uploading || !captureForm.code || !captureForm.name) ? 0.5 : 1 }}
          >
            {uploading ? "Creating..." : "Create Asset"}
          </button>
        </div>
      </div>
    </div>
  );
}
