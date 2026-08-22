import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from 'react-bootstrap/Modal';

/**
 * Live-camera capture dialog.
 * Opens the device camera (rear by default), lets the user snap a photo,
 * review/retake, and returns a JPEG File via onCapture(file).
 */
export default function CameraModal({ show, title = 'Capture image', onCapture, onHide }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState('environment'); // rear camera first
  const [shot, setShot] = useState(null);               // { url, blob }
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [switchable, setSwitchable] = useState(false);

  const stop = useCallback(() => {
    const s = streamRef.current;
    if (s) { s.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setReady(false);
  }, []);

  const start = useCallback(async (mode) => {
    setError(''); setReady(false);
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
      // Can we switch cameras? (more than one video input)
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        setSwitchable(devs.filter((d) => d.kind === 'videoinput').length > 1);
      } catch { /* ignore */ }
    } catch (e) {
      const name = e && e.name;
      setError(
        name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser and try again.'
        : name === 'NotFoundError' ? 'No camera was found on this device. Use “Choose file” instead.'
        : name === 'NotReadableError' ? 'The camera is in use by another app. Close it and try again.'
        : 'Could not open the camera. On phones this needs HTTPS. Use “Choose file” instead.');
    }
  }, [stop]);

  // open/close lifecycle
  useEffect(() => {
    if (show) { setShot(null); start(facing); }
    else { stop(); setShot(null); setError(''); }
    return () => { if (!show) stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const flip = () => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next); start(next);
  };

  const snap = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (facing === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); } // un-mirror selfie
    ctx.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      if (blob) { setShot({ url: URL.createObjectURL(blob), blob }); stop(); }
    }, 'image/jpeg', 0.9);
  };

  const retake = () => { if (shot) URL.revokeObjectURL(shot.url); setShot(null); start(facing); };

  const use = () => {
    if (!shot) return;
    const file = new File([shot.blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
    URL.revokeObjectURL(shot.url);
    onCapture(file);
    onHide();
  };

  const mirror = facing === 'user' && !shot;

  return (
    <Modal show={show} onHide={onHide} centered size="lg" backdrop="static">
      <Modal.Header closeButton><Modal.Title style={{ fontSize: 17 }}>{title}</Modal.Title></Modal.Header>
      <Modal.Body style={{ background: '#0b162d' }}>
        {error ? (
          <div className="text-center text-light py-4">
            <div style={{ fontSize: 40, opacity: 0.5 }}>📷</div>
            <p className="mt-2 mb-0" style={{ color: '#f0b4b4' }}>{error}</p>
          </div>
        ) : (
          <div className="position-relative" style={{ background: '#000', borderRadius: 10, overflow: 'hidden' }}>
            {/* live video */}
            {!shot && (
              <video ref={videoRef} playsInline muted
                style={{ width: '100%', maxHeight: '60vh', display: 'block',
                  transform: mirror ? 'scaleX(-1)' : 'none', objectFit: 'contain' }} />
            )}
            {/* captured preview */}
            {shot && (
              <img src={shot.url} alt="Captured"
                style={{ width: '100%', maxHeight: '60vh', display: 'block', objectFit: 'contain' }} />
            )}
            {!ready && !shot && (
              <div className="position-absolute top-50 start-50 translate-middle text-light">
                <div className="spinner-border text-light" role="status" /> <span className="ms-2">Starting camera…</span>
              </div>
            )}
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <div>
          {!error && !shot && switchable && (
            <button className="btn btn-sm btn-outline-navy" onClick={flip}>⟲ Flip camera</button>
          )}
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-navy" onClick={onHide}>Cancel</button>
          {!error && !shot && (
            <button className="btn btn-sm btn-gold" disabled={!ready} onClick={snap}>◉ Capture</button>
          )}
          {shot && (
            <>
              <button className="btn btn-sm btn-outline-navy" onClick={retake}>↺ Retake</button>
              <button className="btn btn-sm btn-gold" onClick={use}>✔ Use photo</button>
            </>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  );
}
