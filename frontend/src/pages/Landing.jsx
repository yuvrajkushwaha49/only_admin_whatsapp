import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import iconImg from '../assets/icon.png';
import logoImg from '../assets/logo.png';
import '../styles/landing.css';

export default function Landing() {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [activeFaq, setActiveFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqs = [
    {
      q: 'Does Aiveexa use the Official Meta WhatsApp Business Cloud API?',
      a: 'Yes, 100%. Aiveexa is built directly on Meta’s official WhatsApp Cloud API infrastructure. All messages are dispatched directly through Meta servers with zero ban risk, end-to-end encryption, and verified green tick compatibility.'
    },
    {
      q: 'Can I use my existing WhatsApp phone number?',
      a: 'Yes! You can connect any active or new virtual/physical phone number. If the number is currently registered on standard WhatsApp or WhatsApp Business App, we provide a quick 2-minute migration guide to transfer it to Meta Cloud API seamlessly.'
    },
    {
      q: 'How does WhatsApp conversation billing work?',
      a: 'Meta charges based on 24-hour conversation windows categorized as Marketing, Utility, Authentication, or Service. The first 1,000 Service conversations each month are 100% FREE from Meta. Aiveexa provides transparent real-time cost tracking right inside your dashboard.'
    },
    {
      q: 'Can multiple agents manage the same WhatsApp number simultaneously?',
      a: 'Absolutely. Aiveexa includes a Shared Team Inbox where unlimited team members can respond to incoming chats, assign conversations, add private internal notes, apply customer tags, and track response SLAs.'
    },
    {
      q: 'Can I import my existing customer contacts from Excel or CSV?',
      a: 'Yes! With our Excel/CSV Import Manager, you can bulk import over 100,000+ contacts in seconds, map custom columns (such as names, account IDs, purchase history), and organize them into dynamic targeting groups.'
    },
    {
      q: 'Is there a free trial available?',
      a: 'Yes, we offer an unrestricted 14-day free trial on our Pro plan with no credit card required. You can test broadcasting, team inbox, template creation, and automation instantly.'
    }
  ];

  return (
    <div className="landing-root">
      {/* ---------------------------------------------------------------------
          Sticky Header / Navbar
          --------------------------------------------------------------------- */}
      <header className="landing-navbar py-2">
        <div className="landing-container d-flex align-items-center justify-content-between">
          {/* Brand Logo */}
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none">
            <img
              src={iconImg}
              alt="Aiveexa Icon"
              style={{ width: '38px', height: '38px', objectFit: 'contain' }}
            />
            <img
              src={logoImg}
              alt="Aiveexa"
              style={{ height: '34px', width: 'auto', maxWidth: '145px', objectFit: 'contain' }}
            />
          </Link>

          {/* Desktop Nav Links */}
          <nav className="d-none d-lg-flex align-items-center gap-1">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">How it Works</a>
            <a href="#solutions" className="landing-nav-link">Solutions</a>
            <a href="#pricing" className="landing-nav-link">Pricing</a>
            <a href="#faqs" className="landing-nav-link">FAQs</a>
            <Link to="/privacy" className="landing-nav-link">Privacy</Link>
            <Link to="/terms" className="landing-nav-link">Terms</Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="d-flex align-items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="btn btn-aiveexa-primary btn-sm px-3">
                <i className="bi bi-speedometer2"></i> Open Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-aiveexa-outline btn-sm px-3 d-none d-sm-inline-flex">
                  Log In
                </Link>
                <Link to="/register" className="btn btn-aiveexa-primary btn-sm px-3">
                  Start Free Trial <i className="bi bi-arrow-right"></i>
                </Link>
              </>
            )}

            {/* Mobile Hamburger Button */}
            <button
              className="btn btn-light d-lg-none p-2 border"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation"
            >
              <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'} fs-5`}></i>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="d-lg-none bg-white border-top px-3 py-3 shadow-sm">
            <div className="d-flex flex-column gap-2">
              <a href="#features" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
              <a href="#solutions" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
              <a href="#pricing" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#faqs" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>FAQs</a>
              <Link to="/privacy" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>Privacy Policy</Link>
              <Link to="/terms" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>Terms of Service</Link>
              <hr className="my-2" />
              {!user ? (
                <div className="d-flex gap-2">
                  <Link to="/login" className="btn btn-outline-secondary w-50 py-2">Log In</Link>
                  <Link to="/register" className="btn btn-primary w-50 py-2">Sign Up</Link>
                </div>
              ) : (
                <Link to="/dashboard" className="btn btn-primary w-100 py-2">Dashboard</Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ---------------------------------------------------------------------
          Hero Section
          --------------------------------------------------------------------- */}
      <section className="landing-hero text-center">
        <div className="landing-container">
          {/* Badge */}
          <div className="hero-pill-badge">
            <span className="badge rounded-pill bg-success text-white px-2 py-1" style={{ fontSize: '0.72rem' }}>
              <i className="bi bi-shield-check me-1"></i> OFFICIAL
            </span>
            <span>Meta WhatsApp Business Cloud API Partner</span>
          </div>

          {/* Heading */}
          <h1 className="hero-title">
            Transform WhatsApp Into an <br className="d-none d-md-block" />
            <span className="hero-gradient-text">AI-Powered Revenue Engine</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle">
            Scale your customer acquisition, broadcast personalized marketing campaigns with 98% open rates, 
            and automate 24/7 sales & support with official Meta Cloud API. Zero ban risk, instant setup.
          </p>

          {/* CTA Buttons */}
          <div className="d-flex flex-wrap justify-content-center align-items-center gap-3 mb-3">
            <Link to="/register" className="btn btn-aiveexa-primary btn-lg px-4">
              <i className="bi bi-rocket-takeoff"></i> Start 14-Day Free Trial
            </Link>
            <Link to="/login" className="btn btn-aiveexa-outline btn-lg px-4">
              <i className="bi bi-play-circle text-primary"></i> Explore Live Demo
            </Link>
          </div>

          {/* Micro Trust Copy */}
          <div className="text-muted small d-flex flex-wrap justify-content-center gap-4 mb-5">
            <span><i className="bi bi-check2-circle text-success me-1"></i> No Credit Card Required</span>
            <span><i className="bi bi-check2-circle text-success me-1"></i> 1,000 Free Monthly Service Chats</span>
            <span><i className="bi bi-check2-circle text-success me-1"></i> 2-Minute Onboarding</span>
          </div>

          {/* Interactive Hero Visual Mockup */}
          <div className="dashboard-mockup-frame mx-auto text-start" style={{ maxWidth: '1050px' }}>
            <div className="mockup-header-bar">
              <div className="d-flex align-items-center gap-2">
                <span className="mockup-dot bg-danger"></span>
                <span className="mockup-dot bg-warning"></span>
                <span className="mockup-dot bg-success"></span>
                <span className="text-muted small ms-2 d-none d-sm-inline">aiveexa.com/dashboard/campaigns</span>
              </div>
              <div className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill small">
                <i className="bi bi-lightning-charge-fill me-1"></i> Live Campaign Monitor
              </div>
            </div>

            {/* Dashboard Mockup Body */}
            <div className="p-4 bg-light">
              <div className="row g-3">
                {/* Metric 1 */}
                <div className="col-12 col-md-3">
                  <div className="bg-white p-3 rounded-3 border">
                    <div className="text-muted small fw-semibold">Delivery Rate</div>
                    <div className="h3 fw-bold text-success mb-1">99.4%</div>
                    <div className="small text-muted"><i className="bi bi-arrow-up-right text-success"></i> +4.2% vs last month</div>
                  </div>
                </div>
                {/* Metric 2 */}
                <div className="col-12 col-md-3">
                  <div className="bg-white p-3 rounded-3 border">
                    <div className="text-muted small fw-semibold">Messages Broadcasted</div>
                    <div className="h3 fw-bold text-primary mb-1">128,450</div>
                    <div className="small text-muted"><i className="bi bi-check-all text-primary"></i> Official Meta Cloud API</div>
                  </div>
                </div>
                {/* Metric 3 */}
                <div className="col-12 col-md-3">
                  <div className="bg-white p-3 rounded-3 border">
                    <div className="text-muted small fw-semibold">Average Read Time</div>
                    <div className="h3 fw-bold text-dark mb-1">3.2 Mins</div>
                    <div className="small text-muted"><i className="bi bi-clock-history text-info"></i> Instant engagement</div>
                  </div>
                </div>
                {/* Metric 4 */}
                <div className="col-12 col-md-3">
                  <div className="bg-white p-3 rounded-3 border">
                    <div className="text-muted small fw-semibold">AI Automated Chats</div>
                    <div className="h3 fw-bold text-purple mb-1">87.5%</div>
                    <div className="small text-muted"><i className="bi bi-robot text-purple"></i> 24/7 lead qualification</div>
                  </div>
                </div>
              </div>

              {/* Mock Campaign Row */}
              <div className="bg-white rounded-3 border p-3 mt-3">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pb-2 border-bottom">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill">
                      COMPLETED
                    </span>
                    <span className="fw-bold text-dark">Diwali Super Sale Broadcast #402</span>
                  </div>
                  <div className="small text-muted">Audience: 15,000 VIP Shoppers</div>
                </div>
                <div className="row g-2 mt-2 pt-1 text-center">
                  <div className="col-3">
                    <div className="text-muted small">Sent</div>
                    <div className="fw-bold text-dark">15,000</div>
                  </div>
                  <div className="col-3">
                    <div className="text-muted small">Delivered</div>
                    <div className="fw-bold text-success">14,920 (99.5%)</div>
                  </div>
                  <div className="col-3">
                    <div className="text-muted small">Read</div>
                    <div className="fw-bold text-primary">13,840 (92.3%)</div>
                  </div>
                  <div className="col-3">
                    <div className="text-muted small">Replies Generated</div>
                    <div className="fw-bold text-purple">2,150 (14.3%)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          Stats / Proof Bar
          --------------------------------------------------------------------- */}
      <section className="stats-banner text-center">
        <div className="landing-container">
          <div className="row g-4 justify-content-center">
            <div className="col-6 col-md-3">
              <div className="stat-number">98%</div>
              <div className="text-secondary fw-semibold">WhatsApp Open Rate</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat-number">5X</div>
              <div className="text-secondary fw-semibold">Higher Conversions than Email</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat-number">25M+</div>
              <div className="text-secondary fw-semibold">Messages Delivered Securely</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat-number">99.9%</div>
              <div className="text-secondary fw-semibold">Platform Uptime SLA</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          Core Features Section
          --------------------------------------------------------------------- */}
      <section id="features" className="py-5 my-3">
        <div className="landing-container">
          <div className="text-center mb-5">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill mb-2">
              ENTERPRISE-GRADE CAPABILITIES
            </span>
            <h2 className="display-6 fw-bold text-dark">Everything You Need to Scale on WhatsApp</h2>
            <p className="text-muted lead mx-auto" style={{ maxWidth: '680px' }}>
              Built specifically for modern marketing teams, support agents, and D2C brands.
            </p>
          </div>

          <div className="row g-4">
            {/* Feature 1 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div className="feature-card">
                <div className="feature-icon-wrapper bg-primary-subtle text-primary">
                  <i className="bi bi-broadcast"></i>
                </div>
                <h4 className="fw-bold text-dark mb-2">Smart WhatsApp Broadcasting</h4>
                <p className="text-secondary mb-0">
                  Broadcast personalized rich media messages (images, PDFs, CTA buttons) to thousands of opt-in customers with smart scheduling and zero ban risk.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div className="feature-card">
                <div className="feature-icon-wrapper bg-success-subtle text-success">
                  <i className="bi bi-chat-square-text-fill"></i>
                </div>
                <h4 className="fw-bold text-dark mb-2">Shared Multi-Agent Team Inbox</h4>
                <p className="text-secondary mb-0">
                  Allow your entire sales and support team to respond from a single verified number. Assign conversations, add internal notes, and use canned quick replies.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div className="feature-card">
                <div className="feature-icon-wrapper bg-info-subtle text-info">
                  <i className="bi bi-robot"></i>
                </div>
                <h4 className="fw-bold text-dark mb-2">AI WhatsApp Chatbots</h4>
                <p className="text-secondary mb-0">
                  Deploy intelligent conversational AI chatbots to answer customer queries, qualify leads, and collect customer information 24/7 without manual intervention.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div className="feature-card">
                <div className="feature-icon-wrapper bg-warning-subtle text-warning">
                  <i className="bi bi-file-earmark-spreadsheet-fill"></i>
                </div>
                <h4 className="fw-bold text-dark mb-2">Excel & CSV Audience Manager</h4>
                <p className="text-secondary mb-0">
                  Easily upload 100,000+ contacts with custom parameters (such as name, city, order ID). Automatic phone number normalization and deduplication.
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div className="feature-card" style={{ borderTop: '3px solid #7c3aed' }}>
                <div className="feature-icon-wrapper bg-primary-subtle text-primary">
                  <i className="bi bi-file-code-fill"></i>
                </div>
                <h4 className="fw-bold text-dark mb-2">Meta Template Studio</h4>
                <p className="text-secondary mb-0">
                  Create, preview, and submit Marketing, Utility, and Authentication templates directly to Meta for instant approval. Synchronize status with real-time webhooks.
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="col-12 col-md-6 col-lg-4">
              <div className="feature-card">
                <div className="feature-icon-wrapper bg-danger-subtle text-danger">
                  <i className="bi bi-graph-up-arrow"></i>
                </div>
                <h4 className="fw-bold text-dark mb-2">Real-Time Delivery Analytics</h4>
                <p className="text-secondary mb-0">
                  Deep-dive analytics on sent, delivered, read, and failed statuses. Track conversion ROI, agent response times, and export full audit log CSVs on demand.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          How It Works in 3 Steps
          --------------------------------------------------------------------- */}
      <section id="how-it-works" className="py-5 bg-light border-top border-bottom">
        <div className="landing-container">
          <div className="text-center mb-5">
            <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill mb-2">
              FAST ONBOARDING
            </span>
            <h2 className="display-6 fw-bold text-dark">Get Up & Running in 3 Simple Steps</h2>
            <p className="text-muted lead mx-auto" style={{ maxWidth: '640px' }}>
              No lengthy approvals or technical headache. Start broadcasting in under 5 minutes.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-12 col-md-4">
              <div className="step-card">
                <div className="step-number-badge">1</div>
                <h4 className="fw-bold text-dark mb-2">Connect Meta WhatsApp Account</h4>
                <p className="text-secondary mb-0">
                  Log in with Facebook Embedded Signup to connect your WhatsApp Business Account (WABA) and phone number in 60 seconds with instant verification.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="step-card">
                <div className="step-number-badge">2</div>
                <h4 className="fw-bold text-dark mb-2">Import Contacts or Sync CRM</h4>
                <p className="text-secondary mb-0">
                  Upload your opt-in contact list via CSV or connect via our robust REST APIs. Organize contacts with tags, groups, and custom attributes.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="step-card">
                <div className="step-number-badge">3</div>
                <h4 className="fw-bold text-dark mb-2">Broadcast & Automate Sales</h4>
                <p className="text-secondary mb-0">
                  Pick your approved template, customize dynamic variables, preview live, and hit broadcast. Track read receipts and reply in the Team Inbox in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          Industry Solutions
          --------------------------------------------------------------------- */}
      <section id="solutions" className="py-5">
        <div className="landing-container">
          <div className="text-center mb-5">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill mb-2">
              PROVEN RESULTS
            </span>
            <h2 className="display-6 fw-bold text-dark">Engineered for Every High-Growth Industry</h2>
            <p className="text-muted lead mx-auto" style={{ maxWidth: '650px' }}>
              Whether you are an e-commerce brand, real estate agency, or healthcare provider, Aiveexa drives 5X higher conversions.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-12 col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm p-4 bg-white rounded-4">
                <div className="fs-2 mb-3 text-primary"><i className="bi bi-bag-check-fill"></i></div>
                <h5 className="fw-bold text-dark mb-2">E-Commerce & D2C</h5>
                <p className="text-secondary small mb-3">
                  Recover up to 35% of abandoned carts, send automated order shipping updates, and run flash sales with interactive buttons.
                </p>
                <div className="badge bg-success-subtle text-success mt-auto py-2">35% Abandoned Cart Recovery</div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm p-4 bg-white rounded-4">
                <div className="fs-2 mb-3 text-success"><i className="bi bi-buildings-fill"></i></div>
                <h5 className="fw-bold text-dark mb-2">Real Estate & Auto</h5>
                <p className="text-secondary small mb-3">
                  Instantly qualify high-intent property leads, share PDF floor plans, and book site visits automatically via AI bots.
                </p>
                <div className="badge bg-primary-subtle text-primary mt-auto py-2">4X Faster Lead Response</div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm p-4 bg-white rounded-4">
                <div className="fs-2 mb-3 text-info"><i className="bi bi-mortarboard-fill"></i></div>
                <h5 className="fw-bold text-dark mb-2">Edtech & Institutes</h5>
                <p className="text-secondary small mb-3">
                  Send class alerts, exam admit cards, fee payment reminders, and webinar joining links with 98% guaranteed visibility.
                </p>
                <div className="badge bg-info-subtle text-info mt-auto py-2">90%+ Attendance Turnout</div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm p-4 bg-white rounded-4">
                <div className="fs-2 mb-3 text-warning"><i className="bi bi-heart-pulse-fill"></i></div>
                <h5 className="fw-bold text-dark mb-2">Healthcare & Clinics</h5>
                <p className="text-secondary small mb-3">
                  Automate patient appointment confirmations, send lab test reports privately, and share post-consultation medication care.
                </p>
                <div className="badge bg-warning-subtle text-warning mt-auto py-2">Zero No-Shows</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          Pricing Section
          --------------------------------------------------------------------- */}
      <section id="pricing" className="py-5 bg-light border-top border-bottom">
        <div className="landing-container">
          <div className="text-center mb-4">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill mb-2">
              TRANSPARENT PRICING
            </span>
            <h2 className="display-6 fw-bold text-dark">Simple Plans for Businesses of Any Scale</h2>
            <p className="text-muted lead mx-auto" style={{ maxWidth: '600px' }}>
              No hidden fees. Includes 14-day free trial on all plans.
            </p>

            {/* Monthly / Yearly Toggle */}
            <div className="d-inline-flex align-items-center bg-white p-1 rounded-pill border shadow-xs mt-3">
              <button
                className={`btn btn-sm rounded-pill px-4 ${billingCycle === 'monthly' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly
              </button>
              <button
                className={`btn btn-sm rounded-pill px-4 ${billingCycle === 'yearly' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
                onClick={() => setBillingCycle('yearly')}
              >
                Yearly <span className="badge bg-success ms-1">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="row g-4 mt-2 justify-content-center">
            {/* Starter Plan */}
            <div className="col-12 col-lg-4">
              <div className="pricing-card">
                <div>
                  <h4 className="fw-bold text-dark mb-1">Starter</h4>
                  <p className="text-muted small mb-3">Perfect for solopreneurs & small businesses</p>
                  <div className="d-flex align-items-baseline mb-4">
                    <span className="h1 fw-bold text-dark mb-0">{billingCycle === 'yearly' ? '$29' : '$39'}</span>
                    <span className="text-muted ms-1">/month</span>
                  </div>

                  <ul className="list-unstyled text-secondary small d-flex flex-column gap-2 mb-4">
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> 1 Connected WhatsApp Number</li>
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> 3 Team Agent Seats</li>
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> Up to 15,000 Monthly Broadcasts</li>
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> Shared Team Inbox & Tags</li>
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> Excel/CSV Contact Manager</li>
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> Meta Template Studio Access</li>
                  </ul>
                </div>
                <Link to="/register" className="btn btn-outline-primary w-100 py-2">
                  Get Started Free
                </Link>
              </div>
            </div>

            {/* Growth / Pro Plan (Featured) */}
            <div className="col-12 col-lg-4">
              <div className="pricing-card featured">
                <span className="pricing-popular-tag">MOST POPULAR</span>
                <div>
                  <h4 className="fw-bold text-primary mb-1">Pro Growth</h4>
                  <p className="text-muted small mb-3">For scaling brands & high-volume broadcasts</p>
                  <div className="d-flex align-items-baseline mb-4">
                    <span className="h1 fw-bold text-dark mb-0">{billingCycle === 'yearly' ? '$69' : '$89'}</span>
                    <span className="text-muted ms-1">/month</span>
                  </div>

                  <ul className="list-unstyled text-secondary small d-flex flex-column gap-2 mb-4">
                    <li><i className="bi bi-check-circle-fill text-primary me-2"></i> <strong>Up to 3 Connected Numbers</strong></li>
                    <li><i className="bi bi-check-circle-fill text-primary me-2"></i> <strong>10 Team Agent Seats</strong></li>
                    <li><i className="bi bi-check-circle-fill text-primary me-2"></i> Unlimited Broadcast Campaigns</li>
                    <li><i className="bi bi-check-circle-fill text-primary me-2"></i> AI Auto-Replies & Chatbot Builder</li>
                    <li><i className="bi bi-check-circle-fill text-primary me-2"></i> Advanced Audience Segmentation</li>
                    <li><i className="bi bi-check-circle-fill text-primary me-2"></i> Webhooks & Full REST API</li>
                    <li><i className="bi bi-check-circle-fill text-primary me-2"></i> Priority WhatsApp Support</li>
                  </ul>
                </div>
                <Link to="/register" className="btn btn-aiveexa-primary w-100 py-2 justify-content-center">
                  Start 14-Day Free Trial
                </Link>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="col-12 col-lg-4">
              <div className="pricing-card">
                <div>
                  <h4 className="fw-bold text-dark mb-1">Enterprise</h4>
                  <p className="text-muted small mb-3">For large corporations, franchises & agencies</p>
                  <div className="d-flex align-items-baseline mb-4">
                    <span className="h1 fw-bold text-dark mb-0">{billingCycle === 'yearly' ? '$199' : '$249'}</span>
                    <span className="text-muted ms-1">/month</span>
                  </div>

                  <ul className="list-unstyled text-secondary small d-flex flex-column gap-2 mb-4">
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> Unlimited WhatsApp Numbers</li>
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> Unlimited Agent Seats</li>
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> High-Throughput Tier 4 Meta Queue</li>
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> Multi-Workspace Sub-Accounts</li>
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> Custom AI Model Fine-Tuning</li>
                    <li><i className="bi bi-check-circle-fill text-success me-2"></i> Dedicated Account Manager & SLA</li>
                  </ul>
                </div>
                <a href="mailto:support@aiveexa.com?subject=Enterprise%20Inquiry" className="btn btn-outline-secondary w-100 py-2">
                  Contact Enterprise Sales
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          Frequently Asked Questions (FAQs)
          --------------------------------------------------------------------- */}
      <section id="faqs" className="py-5">
        <div className="landing-container" style={{ maxWidth: '850px' }}>
          <div className="text-center mb-5">
            <span className="badge bg-secondary-subtle text-secondary border px-3 py-1 rounded-pill mb-2">
              GOT QUESTIONS?
            </span>
            <h2 className="display-6 fw-bold text-dark">Frequently Asked Questions</h2>
            <p className="text-muted lead">Everything you need to know about Aiveexa and Meta Cloud API.</p>
          </div>

          <div className="landing-faqs">
            {faqs.map((faq, idx) => (
              <div key={idx} className="landing-faq-item">
                <button
                  className="landing-faq-btn"
                  onClick={() => toggleFaq(idx)}
                  aria-expanded={activeFaq === idx}
                >
                  <span>{faq.q}</span>
                  <i className={`bi ${activeFaq === idx ? 'bi-chevron-up text-primary' : 'bi-chevron-down text-muted'}`}></i>
                </button>
                {activeFaq === idx && (
                  <div className="landing-faq-content">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          Pre-Footer CTA Banner
          --------------------------------------------------------------------- */}
      <section className="py-5">
        <div className="landing-container">
          <div className="landing-cta-banner">
            <h2 className="display-6 fw-bold mb-3">Ready to 5X Your WhatsApp Sales & Engagement?</h2>
            <p className="lead mb-4 mx-auto" style={{ maxWidth: '620px', opacity: 0.9 }}>
              Join thousands of fast-growing businesses broadcasting higher-ROI campaigns with Aiveexa today.
            </p>
            <div className="d-flex flex-wrap justify-content-center gap-3">
              <Link to="/register" className="btn btn-light text-primary btn-lg px-4 fw-bold shadow">
                Start 14-Day Free Trial <i className="bi bi-arrow-right"></i>
              </Link>
              <Link to="/login" className="btn btn-outline-light btn-lg px-4">
                Sign In to Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          Comprehensive Footer
          --------------------------------------------------------------------- */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="row g-4 mb-5">
            {/* Brand column */}
            <div className="col-12 col-lg-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <img src={iconImg} alt="Aiveexa" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                <img src={logoImg} alt="Aiveexa" style={{ height: '32px', width: 'auto', maxWidth: '140px', objectFit: 'contain' }} />
              </div>
              <p className="small text-muted mb-3" style={{ maxWidth: '320px' }}>
                Aiveexa is an official enterprise WhatsApp Business automation & marketing SaaS platform built on the official Meta WhatsApp Business Cloud API.
              </p>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill small">
                  <i className="bi bi-patch-check-fill me-1"></i> Meta Cloud API Verified
                </span>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill small">
                  <i className="bi bi-shield-lock-fill me-1"></i> AES-256 Encrypted
                </span>
              </div>
            </div>

            {/* Product links */}
            <div className="col-6 col-lg-2">
              <div className="landing-footer-heading">Product</div>
              <ul className="list-unstyled d-flex flex-column gap-2 small">
                <li><a href="#features">Broadcasting</a></li>
                <li><a href="#features">Shared Team Inbox</a></li>
                <li><a href="#features">AI Chatbots</a></li>
                <li><a href="#features">Meta Template Studio</a></li>
                <li><a href="#features">Excel Contact Manager</a></li>
                <li><a href="#features">Analytics & Webhooks</a></li>
              </ul>
            </div>

            {/* Solutions links */}
            <div className="col-6 col-lg-2">
              <div className="landing-footer-heading">Solutions</div>
              <ul className="list-unstyled d-flex flex-column gap-2 small">
                <li><a href="#solutions">E-Commerce & D2C</a></li>
                <li><a href="#solutions">Real Estate</a></li>
                <li><a href="#solutions">Edtech & Institutes</a></li>
                <li><a href="#solutions">Healthcare & Clinics</a></li>
                <li><a href="#solutions">Automotive & Travel</a></li>
              </ul>
            </div>

            {/* Resources & Support */}
            <div className="col-6 col-lg-2">
              <div className="landing-footer-heading">Resources</div>
              <ul className="list-unstyled d-flex flex-column gap-2 small">
                <li><a href="#pricing">Pricing Plans</a></li>
                <li><a href="#faqs">Knowledge Base</a></li>
                <li><a href="mailto:support@aiveexa.com">Technical Support</a></li>
                <li><a href="mailto:partner@aiveexa.com">Become a Partner</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="col-6 col-lg-2">
              <div className="landing-footer-heading">Legal & Compliance</div>
              <ul className="list-unstyled d-flex flex-column gap-2 small">
                <li><Link to="/privacy">Privacy Policy</Link></li>
                <li><Link to="/terms">Terms of Service</Link></li>
                <li><a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer">WhatsApp Business Policy <i className="bi bi-box-arrow-up-right small"></i></a></li>
                <li><a href="https://developers.facebook.com/docs/whatsapp/cloud-api" target="_blank" rel="noopener noreferrer">Meta Cloud API Docs <i className="bi bi-box-arrow-up-right small"></i></a></li>
              </ul>
            </div>
          </div>

          <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 pt-3 small text-muted">
            <div>
              &copy; {new Date().getFullYear()} Aiveexa Technologies. All rights reserved.
            </div>
            <div className="d-flex align-items-center gap-3">
              <Link to="/privacy" className="text-muted">Privacy Policy</Link>
              <span>•</span>
              <Link to="/terms" className="text-muted">Terms of Service</Link>
              <span>•</span>
              <a href="mailto:support@aiveexa.com" className="text-muted">support@aiveexa.com</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

