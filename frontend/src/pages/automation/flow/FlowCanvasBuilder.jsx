import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import '../../../styles/flow-canvas.css';
import '../../../styles/automations.css';

const NODE_WIDTH = 280;

const PALETTE_TEMPLATES = [
  {
    type: 'text',
    title: 'Text Message',
    desc: 'Send a regular text message with variables',
    icon: 'bi-chat-text-fill',
    bg: '#059669',
    defaultData: {
      messageType: 'text',
      content: 'Hello {{name}}! Welcome to our WhatsApp service.'
    }
  },
  {
    type: 'interactive_buttons',
    title: 'Interactive Buttons',
    desc: 'Quick reply buttons for user choices',
    icon: 'bi-ui-radios',
    bg: '#2563eb',
    defaultData: {
      messageType: 'interactive_buttons',
      content: 'How can we help you today?',
      buttons: [
        { id: 'btn_1', text: 'Explore Products', action: 'go_to_step', targetStepId: '' },
        { id: 'btn_2', text: 'Request Call Back', action: 'request_callback', targetStepId: '' }
      ]
    }
  },
  {
    type: 'product_library',
    title: 'Product Catalogue',
    desc: 'Show products from your product library',
    icon: 'bi-grid-3x3-gap-fill',
    bg: '#7c3aed',
    defaultData: {
      messageType: 'product_library',
      content: 'Here is our latest collection. Tap below to view details.'
    }
  },
  {
    type: 'callback_action',
    title: 'Request Callback',
    desc: 'Register high-priority lead in CRM',
    icon: 'bi-telephone-inbound-fill',
    bg: '#d97706',
    defaultData: {
      messageType: 'text',
      content: 'Thank you! Our executive will call you shortly.',
      nextAction: 'request_callback'
    }
  }
];

export default function FlowCanvasBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [automation, setAutomation] = useState(null);
  const [definition, setDefinition] = useState({
    triggers: { keywords: ['menu'], buttonId: null },
    steps: [],
    fallback: {}
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Canvas Pan & Zoom
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Selected Node for Right Inspector Drawer
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Dragging Nodes
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Interactive Port-to-Port Wire Connection
  // connectingFrom: { sourceId: string, type: 'trigger' | 'node' | 'button', btnIndex?: number, startX: number, startY: number }
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [connectingMouse, setConnectingMouse] = useState({ x: 0, y: 0 });
  const [hoveredTargetStepId, setHoveredTargetStepId] = useState(null);

  // Load automation data
  useEffect(() => {
    loadAutomation();
  }, [id]);

  const loadAutomation = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/automations/${id}`);
      if (res.data?.success && res.data?.data) {
        const auto = res.data.data;
        setAutomation(auto);
        if (auto.draft_definition) {
          const def = auto.draft_definition;
          // Ensure every step has an initial canvas position
          const stepsWithPos = (def.steps || []).map((step, idx) => ({
            ...step,
            position: step.position || {
              x: 400 + idx * 340,
              y: 160 + (idx % 2 === 0 ? 0 : 80)
            }
          }));
          setDefinition({
            ...def,
            steps: stepsWithPos
          });
          if (stepsWithPos.length > 0) {
            setSelectedNodeId(stepsWithPos[0].id);
          }
        }
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.response?.data?.message || 'Failed to load automation' });
    } finally {
      setLoading(false);
    }
  };

  // Node Dragging Handlers
  const handleNodeMouseDown = (e, nodeId) => {
    if (connectingFrom) return;
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggingNodeId(nodeId);

    const node = definition.steps.find(s => s.id === nodeId);
    const pos = node?.position || { x: 0, y: 0 };

    dragOffsetRef.current = {
      x: (e.clientX / zoom) - pos.x,
      y: (e.clientY / zoom) - pos.y
    };
  };

  // Wire Connection: Mouse Down on an Output Port
  const handlePortMouseDown = (e, sourceId, type, btnIndex = null) => {
    e.stopPropagation();
    e.preventDefault();

    let startX = 0;
    let startY = 0;

    if (type === 'trigger') {
      startX = 70 + 240; // Trigger card right edge
      startY = 180 + 55;
    } else {
      const step = definition.steps.find(s => s.id === sourceId);
      const pos = step?.position || { x: 400, y: 160 };
      startX = pos.x + NODE_WIDTH;
      if (type === 'button') {
        startY = pos.y + 112 + (btnIndex * 28);
      } else {
        startY = pos.y + 50; // Middle of card
      }
    }

    setConnectingFrom({
      sourceId,
      type,
      btnIndex,
      startX,
      startY
    });
    setConnectingMouse({ x: startX, y: startY });
  };

  // Wire Connection: Mouse Up on a Target Input Port (Completes the Wire!)
  const handlePortMouseUp = (e, targetStepId) => {
    e.stopPropagation();
    if (!connectingFrom) return;

    const targetStep = definition.steps.find(s => s.id === targetStepId);
    if (!targetStep) {
      setConnectingFrom(null);
      return;
    }

    // Do not connect to self
    if (connectingFrom.sourceId === targetStepId) {
      setConnectingFrom(null);
      return;
    }

    if (connectingFrom.type === 'trigger') {
      // Connect Trigger -> targetStep (move targetStep to index 0)
      const reordered = [
        targetStep,
        ...definition.steps.filter(s => s.id !== targetStepId)
      ];
      setDefinition(prev => ({ ...prev, steps: reordered }));
      setFeedback({ type: 'success', message: `Trigger now starts with "${targetStep.name}"!` });
    } else if (connectingFrom.type === 'button') {
      // Connect Button -> targetStep
      const sourceStep = definition.steps.find(s => s.id === connectingFrom.sourceId);
      if (sourceStep && Array.isArray(sourceStep.buttons)) {
        const btns = [...sourceStep.buttons];
        if (btns[connectingFrom.btnIndex]) {
          btns[connectingFrom.btnIndex] = {
            ...btns[connectingFrom.btnIndex],
            action: 'go_to_step',
            targetStepId
          };
          updateStepField(connectingFrom.sourceId, 'buttons', btns);
          setFeedback({
            type: 'success',
            message: `Connected "${btns[connectingFrom.btnIndex].text}" → "${targetStep.name}"!`
          });
        }
      }
    } else if (connectingFrom.type === 'node') {
      // Connect Step Output -> targetStep
      updateStepField(connectingFrom.sourceId, 'nextAction', 'go_to_step');
      updateStepField(connectingFrom.sourceId, 'targetStepId', targetStepId);
      setFeedback({
        type: 'success',
        message: `Connected step to "${targetStep.name}"!`
      });
    }

    setConnectingFrom(null);
    setHoveredTargetStepId(null);
  };

  // Disconnect an existing wire
  const handleDisconnectWire = (wireType, sourceId, btnIndex = null) => {
    if (wireType === 'button') {
      const sourceStep = definition.steps.find(s => s.id === sourceId);
      if (sourceStep && Array.isArray(sourceStep.buttons)) {
        const btns = [...sourceStep.buttons];
        if (btns[btnIndex]) {
          btns[btnIndex] = {
            ...btns[btnIndex],
            targetStepId: ''
          };
          updateStepField(sourceId, 'buttons', btns);
          setFeedback({ type: 'info', message: 'Connection removed.' });
        }
      }
    } else if (wireType === 'node') {
      updateStepField(sourceId, 'nextAction', 'end_conversation');
      updateStepField(sourceId, 'targetStepId', '');
      setFeedback({ type: 'info', message: 'Connection removed.' });
    }
  };

  // Canvas Mouse Move (Handles node dragging, canvas panning & dynamic connecting wire)
  const handleMouseMove = (e) => {
    if (connectingFrom) {
      // Compute mouse coordinate relative to canvas content
      const canvasX = Math.round((e.clientX - pan.x) / zoom);
      const canvasY = Math.round((e.clientY - pan.y) / zoom);
      setConnectingMouse({ x: canvasX, y: canvasY });
    } else if (draggingNodeId) {
      const newX = Math.round((e.clientX / zoom) - dragOffsetRef.current.x);
      const newY = Math.round((e.clientY / zoom) - dragOffsetRef.current.y);

      setDefinition(prev => ({
        ...prev,
        steps: prev.steps.map(step => 
          step.id === draggingNodeId
            ? { ...step, position: { x: Math.max(20, newX), y: Math.max(20, newY) } }
            : step
        )
      }));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
    setIsPanning(false);
    if (connectingFrom) {
      setConnectingFrom(null);
      setHoveredTargetStepId(null);
    }
  };

  // Canvas Pan Handlers
  const handleCanvasMouseDown = (e) => {
    if (e.target.closest('.flow-node-card') || e.target.closest('.flow-palette-sidebar') || e.target.closest('.flow-inspector-drawer') || e.target.closest('.flow-port-output') || e.target.closest('.flow-port-input') || e.target.closest('.flow-port-btn-output')) {
      return;
    }
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    };
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(1.8, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom(prev => Math.max(0.5, +(prev - 0.15).toFixed(2)));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 50, y: 50 });
  };

  // Add new Step Node from Palette
  const handleAddNodeFromPalette = (template) => {
    const nextNum = definition.steps.length + 1;
    const newId = `step_${Date.now()}`;
    const newStep = {
      id: newId,
      name: `Step ${nextNum}: ${template.title}`,
      messageType: template.defaultData.messageType || 'text',
      content: template.defaultData.content || '',
      buttons: template.defaultData.buttons ? JSON.parse(JSON.stringify(template.defaultData.buttons)) : [],
      nextAction: template.defaultData.nextAction || 'go_to_next',
      position: {
        x: 400 + (definition.steps.length * 340),
        y: 180 + (definition.steps.length % 2 === 0 ? 0 : 80)
      }
    };

    setDefinition(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
    setSelectedNodeId(newId);
  };

  // Delete Step Node
  const handleDeleteNode = (nodeId) => {
    setDefinition(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== nodeId)
    }));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  // Update specific step field
  const updateStepField = (stepId, field, value) => {
    setDefinition(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === stepId ? { ...step, [field]: value } : step
      )
    }));
  };

  // Update selected step fields from inspector
  const updateSelectedStep = (field, value) => {
    if (!selectedNodeId) return;
    updateStepField(selectedNodeId, field, value);
  };

  // Add button to selected step
  const handleAddButton = () => {
    const step = definition.steps.find(s => s.id === selectedNodeId);
    if (!step) return;
    const btns = step.buttons || [];
    if (btns.length >= 3) return;

    const newBtn = {
      id: `btn_${Date.now()}`,
      text: `Option ${btns.length + 1}`,
      action: 'go_to_step',
      targetStepId: ''
    };
    updateSelectedStep('buttons', [...btns, newBtn]);
  };

  // Update button in selected step
  const handleUpdateButton = (btnIdx, field, val) => {
    const step = definition.steps.find(s => s.id === selectedNodeId);
    if (!step) return;
    const btns = [...(step.buttons || [])];
    btns[btnIdx] = { ...btns[btnIdx], [field]: val };
    updateSelectedStep('buttons', btns);
  };

  // Delete button from selected step
  const handleDeleteButton = (btnIdx) => {
    const step = definition.steps.find(s => s.id === selectedNodeId);
    if (!step) return;
    const btns = (step.buttons || []).filter((_, idx) => idx !== btnIdx);
    updateSelectedStep('buttons', btns);
  };

  // Save Draft to Backend
  const handleSaveDraft = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.put(`/automations/${id}`, {
        name: automation.name,
        purpose: automation.purpose,
        whatsappAccountId: automation.whatsapp_account_id,
        definition
      });
      if (res.data?.success) {
        setAutomation(res.data.data);
        setFeedback({ type: 'success', message: 'Flow canvas saved successfully!' });
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.response?.data?.message || 'Failed to save flow' });
    } finally {
      setSaving(false);
    }
  };

  // Publish Automation
  const handlePublish = async () => {
    setPublishing(true);
    setFeedback(null);
    try {
      await api.put(`/automations/${id}`, {
        name: automation.name,
        purpose: automation.purpose,
        whatsappAccountId: automation.whatsapp_account_id,
        definition
      });
      const res = await api.post(`/automations/${id}/publish`);
      if (res.data?.success) {
        setAutomation(res.data.data);
        setFeedback({ type: 'success', message: 'Automation published live to WhatsApp!' });
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.response?.data?.message || 'Failed to publish automation' });
    } finally {
      setPublishing(false);
    }
  };

  // Helper to compute SVG Bezier Connection Paths
  const renderConnections = () => {
    const lines = [];
    const triggerPos = { x: 70, y: 180 };

    // 1. Trigger connecting to Step 1
    if (definition.steps.length > 0) {
      const step1 = definition.steps[0];
      const startX = triggerPos.x + 240;
      const startY = triggerPos.y + 55;
      const endX = step1.position?.x || 400;
      const endY = (step1.position?.y || 160) + 40;

      const deltaX = Math.abs(endX - startX) * 0.5;
      const d = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;
      lines.push(
        <path key="trig_to_step1" d={d} className="flow-wire-path active" markerEnd="url(#arrowhead-green)" />
      );
    }

    // 2. Step buttons or nextAction connecting to other steps
    definition.steps.forEach((step, idx) => {
      const startX = (step.position?.x || 400) + NODE_WIDTH;

      // Check button connections
      if (Array.isArray(step.buttons)) {
        step.buttons.forEach((btn, bIdx) => {
          if (btn.action === 'go_to_step' && btn.targetStepId) {
            const targetStep = definition.steps.find(s => s.id === btn.targetStepId);
            if (targetStep) {
              const startY = (step.position?.y || 160) + 112 + (bIdx * 28);
              const endX = targetStep.position?.x || 400;
              const endY = (targetStep.position?.y || 160) + 40;

              const deltaX = Math.max(60, Math.abs(endX - startX) * 0.5);
              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;
              const d = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

              lines.push(
                <g key={`btn_${step.id}_${btn.id || bIdx}`} className="flow-wire-group">
                  <path d={d} className="flow-wire-path btn-wire" markerEnd="url(#arrowhead-blue)" />
                  {/* Disconnect Badge on Wire */}
                  <g 
                    className="flow-wire-delete-badge"
                    transform={`translate(${midX}, ${midY})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDisconnectWire('button', step.id, bIdx);
                    }}
                  >
                    <circle r="10" fill="#ef4444" />
                    <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="11" fontWeight="bold">✕</text>
                  </g>
                </g>
              );
            }
          }
        });
      }

      // Check step-level nextAction (either explicit targetStepId or sequential go_to_next)
      if (step.nextAction === 'go_to_step' && step.targetStepId) {
        const targetStep = definition.steps.find(s => s.id === step.targetStepId);
        if (targetStep) {
          const startY = (step.position?.y || 160) + 50;
          const endX = targetStep.position?.x || 400;
          const endY = (targetStep.position?.y || 160) + 40;

          const deltaX = Math.max(60, Math.abs(endX - startX) * 0.5);
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;
          const d = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

          lines.push(
            <g key={`node_${step.id}`} className="flow-wire-group">
              <path d={d} className="flow-wire-path active" markerEnd="url(#arrowhead-green)" />
              <g 
                className="flow-wire-delete-badge"
                transform={`translate(${midX}, ${midY})`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDisconnectWire('node', step.id);
                }}
              >
                <circle r="10" fill="#ef4444" />
                <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="11" fontWeight="bold">✕</text>
              </g>
            </g>
          );
        }
      } else if (step.nextAction === 'go_to_next' && idx < definition.steps.length - 1) {
        const nextStep = definition.steps[idx + 1];
        const startY = (step.position?.y || 160) + 50;
        const endX = nextStep.position?.x || 400;
        const endY = (nextStep.position?.y || 160) + 40;

        const deltaX = Math.max(60, Math.abs(endX - startX) * 0.5);
        const d = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;
        lines.push(
          <path key={`seq_${step.id}`} d={d} className="flow-wire-path" markerEnd="url(#arrowhead-slate)" />
        );
      }
    });

    // 3. Dynamic Interactive Wire while dragging from an Output Port
    if (connectingFrom) {
      const { startX, startY } = connectingFrom;
      const endX = connectingMouse.x;
      const endY = connectingMouse.y;
      const deltaX = Math.max(50, Math.abs(endX - startX) * 0.5);
      const d = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

      lines.push(
        <path 
          key="dynamic_connecting_wire" 
          d={d} 
          className="flow-wire-temp" 
          markerEnd="url(#arrowhead-green)" 
        />
      );
    }

    return lines;
  };

  const selectedStep = definition.steps.find(s => s.id === selectedNodeId);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
        <div className="spinner-border text-success" role="status"></div>
        <span className="ms-3 text-muted fw-semibold">Loading Visual Flow Canvas...</span>
      </div>
    );
  }

  return (
    <div className="flow-builder-container">
      
      {/* 1. Canvas Top Header */}
      <header className="flow-canvas-header">
        <div className="flow-header-left">
          <button 
            type="button" 
            className="flow-back-btn" 
            onClick={() => navigate('/automations')}
            title="Back to Automations Dashboard"
          >
            <i className="bi bi-arrow-left"></i>
          </button>

          <div className="flow-title-wrap">
            <h5 className="flow-auto-name">
              <i className="bi bi-diagram-3-fill text-success"></i>
              <span>{automation?.name || 'Untitled Automation'}</span>
              <span className={`flow-status-pill ${automation?.status || 'draft'}`}>
                {automation?.status || 'draft'}
              </span>
            </h5>
          </div>
        </div>

        {/* View Switcher: Classic Builder vs Visual Canvas */}
        <div className="flow-view-switcher">
          <button 
            type="button" 
            className="flow-view-btn" 
            onClick={() => navigate(`/automations/${id}/builder`)}
          >
            <i className="bi bi-list-check"></i>
            <span>Classic Editor</span>
          </button>
          <button 
            type="button" 
            className="flow-view-btn active"
          >
            <i className="bi bi-diagram-3"></i>
            <span>Visual Canvas (Beta)</span>
          </button>
        </div>

        {/* Header Actions */}
        <div className="flow-header-actions">
          {feedback && (
            <span className={`badge ${feedback.type === 'success' ? 'bg-success' : 'bg-danger'} py-2 px-3 small`}>
              {feedback.message}
            </span>
          )}

          <button 
            type="button" 
            className="btn btn-outline-secondary btn-sm px-3 fw-semibold rounded-3" 
            onClick={handleSaveDraft} 
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-cloud-arrow-up me-1"></i> Save Draft
              </>
            )}
          </button>

          <button 
            type="button" 
            className="btn btn-emerald-brand btn-sm px-3 py-1.5" 
            onClick={handlePublish} 
            disabled={publishing}
          >
            {publishing ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Publishing...
              </>
            ) : (
              <>
                <i className="bi bi-send-fill me-1"></i> Publish Live
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flow-canvas-workspace">
        
        {/* Left Palette / Node Toolbox */}
        <aside className="flow-palette-sidebar">
          <div className="flow-palette-header">
            <span>Flow Blocks</span>
            <span className="badge bg-light text-muted border">Click to Add</span>
          </div>

          <div className="flow-palette-items">
            {PALETTE_TEMPLATES.map((tpl) => (
              <div 
                key={tpl.type} 
                className="flow-palette-item"
                onClick={() => handleAddNodeFromPalette(tpl)}
              >
                <div className="flow-palette-icon" style={{ backgroundColor: tpl.bg, color: '#ffffff' }}>
                  <i className={`bi ${tpl.icon}`}></i>
                </div>
                <div>
                  <div className="flow-palette-title">{tpl.title}</div>
                  <div className="flow-palette-desc">{tpl.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Tip Box */}
          <div className="p-3 mt-auto bg-light border-top text-muted small" style={{ fontSize: '0.74rem' }}>
            <div className="fw-bold text-dark mb-1">
              <i className="bi bi-lightning-charge-fill text-warning me-1"></i> How to Connect Arrows:
            </div>
            Drag from any <strong>Circle Dot (Port)</strong> on the right of a block/button and drop it onto the <strong>Input Dot</strong> of another block to connect them!
          </div>
        </aside>

        {/* Center: The Infinite Dot Canvas */}
        <main 
          className="flow-canvas-viewport"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: connectingFrom ? 'crosshair' : (isPanning ? 'grabbing' : 'grab') }}
        >
          {/* Zoom & Canvas Controls */}
          <div className="flow-canvas-controls">
            <button type="button" className="flow-control-btn" onClick={handleZoomIn} title="Zoom In">
              <i className="bi bi-zoom-in"></i>
            </button>
            <span className="flow-zoom-label">{Math.round(zoom * 100)}%</span>
            <button type="button" className="flow-control-btn" onClick={handleZoomOut} title="Zoom Out">
              <i className="bi bi-zoom-out"></i>
            </button>
            <button type="button" className="flow-control-btn" onClick={handleResetView} title="Reset View">
              <i className="bi bi-aspect-ratio"></i>
            </button>
          </div>

          {/* Canvas Transform Content */}
          <div 
            className="flow-canvas-content"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
            }}
          >
            {/* SVG Connecting Wires */}
            <svg className="flow-wires-svg" width="5000" height="5000">
              <defs>
                <marker id="arrowhead-green" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                </marker>
                <marker id="arrowhead-blue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
                </marker>
                <marker id="arrowhead-slate" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
              </defs>
              {renderConnections()}
            </svg>

            {/* Trigger Start Node (Static Anchor on Canvas) */}
            <div 
              className="flow-node-card"
              style={{ left: 70, top: 180, width: 240 }}
            >
              <div className="flow-node-header trigger">
                <div className="flow-node-title-box">
                  <div className="flow-node-icon" style={{ backgroundColor: '#10b981' }}>
                    <i className="bi bi-play-circle-fill"></i>
                  </div>
                  <h6 className="flow-node-name">1. How It Starts</h6>
                </div>
              </div>
              <div className="flow-node-body">
                <span className="badge bg-light text-dark border me-1 mb-1">
                  <i className="bi bi-chat-dots-fill text-success me-1"></i>
                  Keywords: {definition.triggers?.keywords?.join(', ') || 'menu'}
                </span>
                <p className="text-muted small mt-2 mb-0" style={{ fontSize: '0.74rem' }}>
                  Drag green dot to connect with the first message!
                </p>
              </div>
              {/* Trigger Output Port */}
              <div 
                className="flow-port-output" 
                title="Drag to connect first message"
                onMouseDown={(e) => handlePortMouseDown(e, 'trigger', 'trigger')}
              ></div>
            </div>

            {/* Interactive Step Nodes */}
            {definition.steps.map((step, idx) => {
              const isSelected = selectedNodeId === step.id;
              const pos = step.position || { x: 400 + idx * 340, y: 160 };
              const isTargetHovered = hoveredTargetStepId === step.id;

              return (
                <div
                  key={step.id}
                  className={`flow-node-card ${isSelected ? 'selected' : ''} ${isTargetHovered ? 'selected' : ''}`}
                  style={{ left: pos.x, top: pos.y }}
                  onMouseDown={(e) => handleNodeMouseDown(e, step.id)}
                  onMouseEnter={() => {
                    if (connectingFrom && connectingFrom.sourceId !== step.id) {
                      setHoveredTargetStepId(step.id);
                    }
                  }}
                  onMouseLeave={() => {
                    if (hoveredTargetStepId === step.id) {
                      setHoveredTargetStepId(null);
                    }
                  }}
                  onMouseUp={(e) => {
                    if (connectingFrom && connectingFrom.sourceId !== step.id) {
                      handlePortMouseUp(e, step.id);
                    }
                  }}
                >
                  {/* Left Input Port (Drop target for wires!) */}
                  <div 
                    className={`flow-port-input ${isTargetHovered ? 'highlight-target' : ''}`}
                    title="Release wire here to connect!"
                    onMouseUp={(e) => handlePortMouseUp(e, step.id)}
                  ></div>

                  {/* Card Header */}
                  <div className="flow-node-header message">
                    <div className="flow-node-title-box">
                      <div className="flow-node-icon" style={{ backgroundColor: '#2563eb' }}>
                        <i className="bi bi-chat-square-text-fill"></i>
                      </div>
                      <h6 className="flow-node-name">{step.name || `Step ${idx + 1}`}</h6>
                    </div>
                    <button 
                      type="button" 
                      className="btn-close" 
                      style={{ fontSize: '0.65rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNode(step.id);
                      }}
                      title="Delete Step"
                    ></button>
                  </div>

                  {/* Card Body */}
                  <div className="flow-node-body">
                    <div className="flow-node-preview-text">
                      {step.content || '(Empty message text...)'}
                    </div>

                    {/* Interactive Buttons */}
                    {Array.isArray(step.buttons) && step.buttons.length > 0 && (
                      <div className="flow-node-buttons">
                        {step.buttons.map((btn, bIdx) => (
                          <div key={btn.id || bIdx} className="flow-node-btn-row">
                            <span className="text-truncate" style={{ maxWidth: '210px' }}>
                              <i className="bi bi-hand-index-thumb text-primary me-1"></i> {btn.text}
                            </span>
                            {/* Button Output Port (Drag from here to connect this button to another block!) */}
                            <div 
                              className="flow-port-btn-output" 
                              title={`Drag arrow from button "${btn.text}" to next step`}
                              onMouseDown={(e) => handlePortMouseDown(e, step.id, 'button', bIdx)}
                            ></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Output Port (Drag from here to connect entire step to next step!) */}
                  <div 
                    className="flow-port-output" 
                    title="Drag arrow to next step"
                    onMouseDown={(e) => handlePortMouseDown(e, step.id, 'node')}
                  ></div>
                </div>
              );
            })}

          </div>
        </main>

        {/* Right Drawer: Step Inspector & Editor */}
        {selectedStep && (
          <aside className="flow-inspector-drawer">
            <div className="flow-inspector-header">
              <h6 className="flow-inspector-title">
                <i className="bi bi-sliders text-success"></i>
                <span>Edit Step: {selectedStep.name}</span>
              </h6>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setSelectedNodeId(null)}
              ></button>
            </div>

            <div className="flow-inspector-body">
              {/* Step Name */}
              <div className="mb-3">
                <label className="flow-form-label">Step Name</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  value={selectedStep.name || ''}
                  onChange={(e) => updateSelectedStep('name', e.target.value)}
                  placeholder="e.g. Welcome Greeting, Product Menu"
                />
              </div>

              {/* Message Type */}
              <div className="mb-3">
                <label className="flow-form-label">Message Type</label>
                <select 
                  className="form-select form-select-sm"
                  value={selectedStep.messageType || 'text'}
                  onChange={(e) => updateSelectedStep('messageType', e.target.value)}
                >
                  <option value="text">Text Message</option>
                  <option value="interactive_buttons">Interactive Buttons (Quick Replies)</option>
                  <option value="product_library">Product Catalogue</option>
                  <option value="image">Image Attachment</option>
                </select>
              </div>

              {/* Message Content */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="flow-form-label mb-0">Message Content</label>
                  <span className="text-muted small">Supports emojis & variables</span>
                </div>
                <textarea 
                  className="form-control form-control-sm"
                  rows="4"
                  value={selectedStep.content || ''}
                  onChange={(e) => updateSelectedStep('content', e.target.value)}
                  placeholder="Type your WhatsApp message..."
                ></textarea>
                
                {/* Dynamic Variables Chips */}
                <div className="d-flex flex-wrap gap-1 mt-2">
                  {['{{name}}', '{{phone}}', '{{city}}'].map(tag => (
                    <button 
                      key={tag}
                      type="button" 
                      className="btn btn-sm btn-light border py-0 px-2 font-monospace"
                      style={{ fontSize: '0.72rem' }}
                      onClick={() => updateSelectedStep('content', (selectedStep.content || '') + ' ' + tag)}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Buttons Config */}
              {selectedStep.messageType === 'interactive_buttons' && (
                <div className="mb-3 border-top pt-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="flow-form-label mb-0">Quick Reply Buttons ({selectedStep.buttons?.length || 0}/3)</label>
                    {(selectedStep.buttons?.length || 0) < 3 && (
                      <button 
                        type="button" 
                        className="btn btn-outline-primary btn-sm py-0 px-2"
                        style={{ fontSize: '0.75rem' }}
                        onClick={handleAddButton}
                      >
                        + Add Button
                      </button>
                    )}
                  </div>

                  <div className="d-flex flex-column gap-2">
                    {(selectedStep.buttons || []).map((btn, bIdx) => (
                      <div key={btn.id || bIdx} className="bg-light p-2 rounded-3 border">
                        <div className="d-flex align-items-center gap-1 mb-1.5">
                          <input 
                            type="text"
                            className="form-control form-control-sm"
                            value={btn.text}
                            onChange={(e) => handleUpdateButton(bIdx, 'text', e.target.value)}
                            placeholder="Button label..."
                            maxLength={20}
                          />
                          <button 
                            type="button" 
                            className="btn btn-outline-danger btn-sm p-1"
                            onClick={() => handleDeleteButton(bIdx)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>

                        {/* Action when button is tapped */}
                        <div className="row g-1">
                          <div className="col-5">
                            <select 
                              className="form-select form-select-sm"
                              value={btn.action}
                              onChange={(e) => handleUpdateButton(bIdx, 'action', e.target.value)}
                              style={{ fontSize: '0.75rem' }}
                            >
                              <option value="go_to_step">Go to Step</option>
                              <option value="request_callback">Request Callback</option>
                              <option value="end_conversation">End Chat</option>
                            </select>
                          </div>
                          {btn.action === 'go_to_step' && (
                            <div className="col-7">
                              <select 
                                className="form-select form-select-sm"
                                value={btn.targetStepId || ''}
                                onChange={(e) => handleUpdateButton(bIdx, 'targetStepId', e.target.value)}
                                style={{ fontSize: '0.75rem' }}
                              >
                                <option value="">Select Target Step...</option>
                                {definition.steps
                                  .filter(s => s.id !== selectedStep.id)
                                  .map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Action if not buttons */}
              {selectedStep.messageType !== 'interactive_buttons' && (
                <div className="mb-3 border-top pt-3">
                  <label className="flow-form-label">After Sending Message</label>
                  <select 
                    className="form-select form-select-sm mb-2"
                    value={selectedStep.nextAction || 'go_to_next'}
                    onChange={(e) => updateSelectedStep('nextAction', e.target.value)}
                  >
                    <option value="go_to_next">Go to Next Step in Flow</option>
                    <option value="go_to_step">Go to Specific Step (Connected Arrow)</option>
                    <option value="request_callback">Offer Callback to Lead</option>
                    <option value="end_conversation">End Conversation</option>
                  </select>

                  {selectedStep.nextAction === 'go_to_step' && (
                    <select 
                      className="form-select form-select-sm"
                      value={selectedStep.targetStepId || ''}
                      onChange={(e) => updateSelectedStep('targetStepId', e.target.value)}
                    >
                      <option value="">Select Target Step...</option>
                      {definition.steps
                        .filter(s => s.id !== selectedStep.id)
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                  )}
                </div>
              )}

            </div>
          </aside>
        )}

      </div>
    </div>
  );
}
