import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  Factory,
  HardDrive,
  ShieldCheck,
  Truck,
  Users,
  Cloud,
} from 'lucide-react';
import { Badge, Button } from './components';
export function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Factory size={22} />
          </span>
          <span>
            factory<span className="brand-sub">FASTENERS ERP</span>
          </span>
        </Link>
        <nav>
          <a href="#workflow">The workflow</a>
          <a href="#modes">Two ways to work</a>
          <Link to="/app">
            Open workspace <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <Badge tone="success">
              <span className="save-dot" /> BUILT FOR THE FACTORY FLOOR
            </Badge>
            <h1>
              From first enquiry.
              <br />
              To final <em>dispatch.</em>
            </h1>
            <p>
              Give every order, material lot and quality decision a clear place. Manufacturing
              operations that stay connected to the actual work.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link to="/app">
                  Open your factory <ArrowRight size={18} />
                </Link>
              </Button>
              <a className="text-link" href="#workflow">
                See how it fits together <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="hero-notes">
              <span>
                <Check size={15} /> Local-first solo
              </span>
              <span>
                <Check size={15} /> Shared online teams
              </span>
              <span>
                <Check size={15} /> Exact stock records
              </span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="Illustration of a traceable manufacturing workflow"
          >
            <div className="visual-top">
              <span className="visual-logo">
                <Factory size={18} /> SAMPLE FACTORY
              </span>
              <Badge>Illustrative workflow</Badge>
            </div>
            <div className="visual-title">
              <span>Order command center</span>
              <strong>Every step has a record.</strong>
            </div>
            <div className="workflow-track">
              {[
                { icon: Box, title: 'Material readiness', detail: 'Receipt · lot · custody' },
                { icon: Factory, title: 'Production', detail: 'Work · consumption · output' },
                {
                  icon: ShieldCheck,
                  title: 'Quality gates',
                  detail: 'Inspection · hold · release',
                },
                { icon: Truck, title: 'Dispatch', detail: 'Package · scan · shipment' },
              ].map(({ icon: Icon, title, detail }, index) => (
                <div key={title} className="workflow-step">
                  <span className="step-number">0{index + 1}</span>
                  <span className="step-icon">
                    <Icon size={20} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </div>
              ))}
            </div>
            <div className="visual-footer">
              <span className="save-dot" /> Clear ownership. Recorded decisions. Traceable lots.
            </div>
          </div>
        </section>
        <section className="landing-strip">
          <span>MADE FOR FASTENERS & PRECISION COMPONENTS</span>
          <span>
            Sales <i>/</i> Engineering <i>/</i> Stores <i>/</i> Production <i>/</i> Quality <i>/</i>{' '}
            Dispatch
          </span>
        </section>
        <section id="workflow" className="landing-section">
          <p className="eyebrow">ONE OPERATIONAL THREAD</p>
          <h2>
            The whole journey.
            <br />
            Without losing the details.
          </h2>
          <div className="feature-grid">
            {[
              {
                icon: Box,
                title: 'Know where stock stands',
                body: 'Separate usable stock, reservations, QC holds, work in progress and vendor custody.',
              },
              {
                icon: ShieldCheck,
                title: 'Keep quality in the flow',
                body: 'Current holds and release evidence control the next physical movement.',
              },
              {
                icon: Users,
                title: 'Give access with intent',
                body: 'Company roles and plant scope define what each member can see and do.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <article key={title}>
                <Icon size={25} />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="modes" className="landing-section mode-section">
          <div>
            <p className="eyebrow">CHOOSE YOUR AUTHORITY</p>
            <h2>
              Your device.
              <br />
              Or your whole team.
            </h2>
            <p>
              Independent solo workspaces and shared companies have clear boundaries. Connecting to
              the internet does not silently move your data.
            </p>
          </div>
          <div className="landing-modes">
            <article>
              <HardDrive size={24} />
              <h3>Solo, saved here</h3>
              <p>
                SQLite-backed operation on this device. Single-owner reviews, without registration.
              </p>
            </article>
            <article>
              <Cloud size={24} />
              <h3>Team, shared online</h3>
              <p>
                Supabase company workspaces, active memberships, and server-enforced permissions.
              </p>
            </article>
          </div>
        </section>
        <section className="landing-cta">
          <div>
            <p className="eyebrow">START WITH A CLEAR RECORD</p>
            <h2>Make your next move count.</h2>
            <p>Open an empty workspace or explore clearly labeled fictional SAMPLE data.</p>
          </div>
          <Button asChild>
            <Link to="/app">
              Open workspace <ArrowRight size={18} />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="landing-footer">
        <span>factory / FASTENERS ERP</span>
        <span>v0.1.0 · Manufacturing design proposal · Runtime acceptance in progress</span>
      </footer>
    </div>
  );
}
