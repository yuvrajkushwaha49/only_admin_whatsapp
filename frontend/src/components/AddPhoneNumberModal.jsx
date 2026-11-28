import React, { useState, useEffect } from 'react';
import api from '../services/api';

const COMMON_COUNTRY_CODES = [
  { code: '91', label: 'India (+91)' },
  { code: '1', label: 'USA / Canada (+1)' },
  { code: '971', label: 'UAE (+971)' },
  { code: '44', label: 'UK (+44)' },
  { code: '65', label: 'Singapore (+65)' },
  { code: '61', label: 'Australia (+61)' },
  { code: '966', label: 'Saudi Arabia (+966)' }
];

export default function AddPhoneNumberModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1 = Add Number / Send OTP, 2 = Enter OTP & PIN
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [wabaInfo, setWabaInfo] = useState(null);

  const [selectedWabaId, setSelectedWabaId] = useState('');
  const [countryCode, setCountryCode] = useState('91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verifiedName, setVerifiedName] = useState('');
  const [codeMethod, setCodeMethod] = useState('SMS');

  const [pendingSession, setPendingSession] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [pin, setPin] = useState('123456');

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      resetModal();
      loadWabaInfo();
    }
  }, [isOpen]);

  const resetModal = () => {
    setStep(1);
    setCountryCode('91');
    setPhoneNumber('');
    setVerifiedName('');
    setCodeMethod('SMS');
    setPendingSession(null);
    setOtpCode('');
    setPin('123456');
    setError('');
    setInfoMsg('');
  };

  const loadWabaInfo = async (wabaIdOverride = null) => {
    try {
      setLoadingInfo(true);
      const url = wabaIdOverride
        ? `/whatsapp/accounts/waba-info?wabaId=${encodeURIComponent(wabaIdOverride)}`
        : '/whatsapp/accounts/waba-info';
      const res = await api.get(url);
      if (res.data?.success && res.data.data) {
        const data = res.data.data;
        setWabaInfo(data);
        if (data.wabaId) setSelectedWabaId(data.wabaId);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to load Meta WABA configuration.');
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMsg('');

    try {
      setSubmitting(true);
      const res = await api.post('/whatsapp/accounts/phone-numbers/add-and-send-otp', {
        wabaId: selectedWabaId || undefined,
        countryCode,
        phoneNumber,
        verifiedName,
        codeMethod
      });

      const data = res.data?.data;
      setPendingSession(data);
      setStep(2);
      setInfoMsg(res.data?.message || `Verification OTP sent via ${codeMethod}.`);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to add number or send OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExistingWabaNumber = async (metaNum) => {
    setError('');
    setInfoMsg('');
    const targetWabaId = metaNum.wabaId || selectedWabaId || wabaInfo?.wabaId;

    if (metaNum.codeVerificationStatus === 'VERIFIED' || metaNum.isMetaProvided) {
      setSelectedWabaId(targetWabaId);
      setPendingSession({
        wabaId: targetWabaId,
        phoneNumberId: metaNum.id,
        verifiedName: metaNum.verifiedName,
        fullPhoneNumber: metaNum.displayPhoneNumber,
        alreadyVerified: true
      });
      setStep(2);
      setInfoMsg(`${metaNum.displayPhoneNumber} is already verified by Meta. Click "Verify & Connect Number" to activate it in this software.`);
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/whatsapp/accounts/phone-numbers/add-and-send-otp', {
        wabaId: targetWabaId,
        existingPhoneNumberId: metaNum.id,
        verifiedName: metaNum.verifiedName,
        phoneNumber: metaNum.displayPhoneNumber,
        codeMethod
      });
      setSelectedWabaId(targetWabaId);
      setPendingSession(res.data?.data);
      setStep(2);
      setInfoMsg(`Verification OTP sent via ${codeMethod} to ${metaNum.displayPhoneNumber}.`);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to request OTP for selected number.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async (methodOverride) => {
    if (!pendingSession?.phoneNumberId) return;
    setError('');
    setInfoMsg('');
    const method = methodOverride || codeMethod;

    try {
      setResending(true);
      const res = await api.post('/whatsapp/accounts/phone-numbers/resend-otp', {
        wabaId: pendingSession.wabaId || selectedWabaId,
        phoneNumberId: pendingSession.phoneNumberId,
        codeMethod: method
      });
      setCodeMethod(method);
      setInfoMsg(res.data?.message || `OTP resent via ${method}.`);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyAndConnect = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    try {
      setSubmitting(true);
      const res = await api.post('/whatsapp/accounts/phone-numbers/verify-and-connect', {
        wabaId: pendingSession?.wabaId || selectedWabaId,
        phoneNumberId: pendingSession?.phoneNumberId,
        code: otpCode,
        pin,
        displayName: pendingSession?.verifiedName || verifiedName,
        phoneNumber: pendingSession?.fullPhoneNumber,
        skipVerifyCode: Boolean(pendingSession?.alreadyVerified)
      });

      if (onSuccess) {
        onSuccess(res.data?.data, res.data?.message);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Verification failed. Check OTP and 6-digit PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const unconnectedMetaNumbers = (wabaInfo?.wabaPhoneNumbers || []).filter(p => !p.isConnectedInSoftware);

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(4px)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          <div
            className="modal-header py-3 text-white"
            style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
          >
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-whatsapp fs-4"></i>
              <div>
                <h5 className="modal-title fw-bold mb-0">Add & Verify WhatsApp Number</h5>
                <small className="opacity-75">Direct Cloud API OTP Verification (No Meta Login Required)</small>
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4 bg-white">
            {/* Step Indicator */}
            <div className="d-flex align-items-center justify-content-center gap-3 mb-4">
              <div className={`badge rounded-pill px-3 py-2 ${step === 1 ? 'bg-success text-white' : 'bg-success-subtle text-success'}`}>
                1. Add Phone Number
              </div>
              <i className="bi bi-arrow-right text-muted"></i>
              <div className={`badge rounded-pill px-3 py-2 ${step === 2 ? 'bg-success text-white' : 'bg-light text-secondary border'}`}>
                2. OTP Verify & Activate
              </div>
            </div>

            {error && (
              <div className="alert alert-danger py-2 small d-flex align-items-start gap-2">
                <i className="bi bi-exclamation-triangle-fill mt-1"></i>
                <div>{error}</div>
              </div>
            )}

            {infoMsg && (
              <div className="alert alert-success py-2 small d-flex align-items-start gap-2">
                <i className="bi bi-check-circle-fill mt-1"></i>
                <div>{infoMsg}</div>
              </div>
            )}

            {loadingInfo ? (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border spinner-border-sm text-success me-2"></div>
                Loading your connected Meta Business Account...
              </div>
            ) : !wabaInfo?.configured ? (
              <div className="alert alert-warning mb-0">
                <strong>No active WABA / Token configured yet.</strong> Please connect your primary Meta WABA in `.env` or via Manual Setup first.
              </div>
            ) : step === 1 ? (
              <>
                {/* Active Portfolio & WABA Badge */}
                <div className="p-3 rounded-3 mb-3 border bg-light d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div>
                    {wabaInfo.businessId && (
                      <div className="small text-secondary mb-1">
                        Business Portfolio:{' '}
                        <strong className="text-dark">{wabaInfo.businessName || 'Drt lifesciences llp'}</strong>{' '}
                        <code className="text-primary">({wabaInfo.businessId})</code>
                      </div>
                    )}
                    <div className="small text-secondary fw-semibold">Target WhatsApp Business Account (WABA)</div>
                    <div className="fw-bold text-dark">
                      {wabaInfo.wabaName || 'Connected WABA'}{' '}
                      <code className="ms-1 text-success">({selectedWabaId || wabaInfo.wabaId})</code>
                    </div>
                  </div>
                  {(wabaInfo.availableWabas || []).length > 1 && (
                    <select
                      className="form-select form-select-sm w-auto"
                      value={selectedWabaId}
                      onChange={(e) => {
                        setSelectedWabaId(e.target.value);
                        loadWabaInfo(e.target.value);
                      }}
                    >
                      {wabaInfo.availableWabas.map(w => (
                        <option key={w.wabaId} value={w.wabaId}>{w.label} ({w.wabaId})</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Unconnected / Meta-Provided numbers already available on Meta WABAs */}
                {unconnectedMetaNumbers.length > 0 && (
                  <div className="mb-4 p-3 rounded-3 border border-success-subtle" style={{ background: '#f0fdf4' }}>
                    <div className="small fw-bold text-success mb-2">
                      <i className="bi bi-stars me-1"></i>
                      Meta-Provided &amp; Pending Numbers on Your Business Portfolio ({unconnectedMetaNumbers.length}):
                    </div>
                    <div className="d-flex flex-column gap-2" style={{ maxHeight: '190px', overflowY: 'auto' }}>
                      {unconnectedMetaNumbers.map(num => (
                        <div key={num.id} className="bg-white p-2 px-3 rounded border d-flex flex-wrap align-items-center justify-content-between gap-2">
                          <div>
                            <div className="fw-bold text-dark d-flex align-items-center gap-2">
                              <span>{num.displayPhoneNumber}</span>
                              {num.isMetaProvided && (
                                <span className="badge bg-info-subtle text-info border border-info-subtle" style={{ fontSize: '0.68rem' }}>
                                  Meta Provided Number
                                </span>
                              )}
                            </div>
                            <div className="small text-muted">
                              {num.verifiedName} • WABA: <code>{num.wabaId}</code> •{' '}
                              <span className={`badge ${num.codeVerificationStatus === 'VERIFIED' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-dark'}`}>
                                {num.codeVerificationStatus}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleExistingWabaNumber(num)}
                            className="btn btn-sm btn-success fw-semibold"
                          >
                            {num.codeVerificationStatus === 'VERIFIED' || num.isMetaProvided ? 'Connect Now' : 'Verify via OTP'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Form to add a brand-new phone number directly into WABA */}
                <form onSubmit={handleSendOtp}>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">WhatsApp Display Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      className="form-control"
                      placeholder="e.g. DRT Life Sciences Support"
                      value={verifiedName}
                      onChange={(e) => setVerifiedName(e.target.value)}
                    />
                    <div className="form-text small">Should match your business identity on WhatsApp.</div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-sm-4">
                      <label className="form-label small fw-semibold">Country Code <span className="text-danger">*</span></label>
                      <select
                        className="form-select"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                      >
                        {COMMON_COUNTRY_CODES.map(c => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-sm-8">
                      <label className="form-label small fw-semibold">Phone Number (without +{countryCode}) <span className="text-danger">*</span></label>
                      <input
                        type="tel"
                        required
                        className="form-control"
                        placeholder="9876543210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold d-block">OTP Verification Method</label>
                    <div className="btn-group w-100" role="group">
                      <button
                        type="button"
                        className={`btn btn-sm ${codeMethod === 'SMS' ? 'btn-success' : 'btn-outline-secondary'}`}
                        onClick={() => setCodeMethod('SMS')}
                      >
                        <i className="bi bi-chat-dots-fill me-1"></i> Send OTP via SMS
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${codeMethod === 'VOICE' ? 'btn-success' : 'btn-outline-secondary'}`}
                        onClick={() => setCodeMethod('VOICE')}
                      >
                        <i className="bi bi-telephone-fill me-1"></i> Send OTP via Voice Call
                      </button>
                    </div>
                  </div>

                  <div className="alert alert-light border small text-secondary mb-3">
                    <i className="bi bi-info-circle me-1 text-success"></i>
                    Apna number regular WhatsApp / WhatsApp Business mobile app se remove hona chahiye. Agar aapko <strong>Meta ka naya free +1 555 number</strong> claim karna hai, to pehle <em>Connect via Facebook</em> se ya Meta Dashboard me generate karein — uske baad wo automatically upar <strong>Meta-Provided Numbers</strong> list me aa jayega.
                  </div>

                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="btn btn-success fw-semibold px-4">
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Adding & Sending OTP...
                        </>
                      ) : (
                        <>Send Verification OTP &rarr;</>
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <form onSubmit={handleVerifyAndConnect}>
                <div className="p-3 rounded-3 mb-3 border bg-light">
                  <div className="small text-secondary">Verifying Phone Number</div>
                  <div className="fw-bold fs-6 text-dark">
                    {pendingSession?.fullPhoneNumber} — {pendingSession?.verifiedName}
                  </div>
                  <div className="small text-muted">
                    Meta Phone ID: <code>{pendingSession?.phoneNumberId}</code> • WABA: <code>{pendingSession?.wabaId}</code>
                  </div>
                </div>

                {!pendingSession?.alreadyVerified && (
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Enter 6-Digit Verification OTP <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      className="form-control form-control-lg text-center fw-bold"
                      style={{ letterSpacing: '0.35em' }}
                      placeholder="••••••"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    />
                    <div className="d-flex align-items-center justify-content-between mt-2">
                      <span className="small text-muted">Didn&apos;t receive the code?</span>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          disabled={resending}
                          onClick={() => handleResendOtp('SMS')}
                          className="btn btn-link btn-sm p-0 text-decoration-none"
                        >
                          Resend SMS
                        </button>
                        <span className="text-muted">•</span>
                        <button
                          type="button"
                          disabled={resending}
                          onClick={() => handleResendOtp('VOICE')}
                          className="btn btn-link btn-sm p-0 text-decoration-none"
                        >
                          Call Me (Voice)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label className="form-label small fw-semibold">
                    6-Digit Two-Step Verification PIN <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    minLength={6}
                    className="form-control"
                    placeholder="123456"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <div className="form-text small">Used by Meta Cloud API to register & secure your number (default: 123456).</div>
                </div>

                <div className="d-flex justify-content-between gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setStep(1);
                      setError('');
                      setInfoMsg('');
                    }}
                  >
                    &larr; Back
                  </button>
                  <button type="submit" disabled={submitting} className="btn btn-success fw-semibold px-4">
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Verifying & Activating...
                      </>
                    ) : (
                      <>Verify & Connect Number</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
