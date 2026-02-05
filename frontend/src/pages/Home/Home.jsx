import { useState, useEffect } from 'react';
import StudentLoginGuide from '../../components/StudentLoginGuide/StudentLoginGuide';
import './Home.css';

const Home = () => {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [stats, setStats] = useState({
    examsMonitored: 0,
    institutions: 0,
    countries: 0,
    detectionAccuracy: 0
  });
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    // Auto-rotate features
    const featureInterval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 5000);

    // Animate stats counter
    const animateCounter = (start, end, duration, setter) => {
      let startTimestamp = null;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        setter(value);
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };
      window.requestAnimationFrame(step);
    };

    setTimeout(() => {
      animateCounter(0, 12500, 2000, (val) => setStats(prev => ({...prev, examsMonitored: val})));
      animateCounter(0, 350, 1500, (val) => setStats(prev => ({...prev, institutions: val})));
      animateCounter(0, 45, 1000, (val) => setStats(prev => ({...prev, countries: val})));
      animateCounter(0, 98.7, 2500, (val) => setStats(prev => ({...prev, detectionAccuracy: val})));
    }, 500);

    // Handle scroll animations
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };
    
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      clearInterval(featureInterval);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const features = [
    {
      title: "AI-Powered Proctoring",
      description: "Advanced algorithms detect suspicious behavior in real-time with 98.7% accuracy",
      icon: "🤖",
      color: "#6366F1"
    },
    {
      title: "Multi-Device Monitoring",
      description: "Simultaneous screen recording, webcam monitoring, and mobile device tracking",
      icon: "📱",
      color: "#10B981"
    },
    {
      title: "Secure Browser Environment",
      description: "Browser lockdown prevents unauthorized access during examinations",
      icon: "🔒",
      color: "#F59E0B"
    },
    {
      title: "Comprehensive Analytics",
      description: "Detailed reports with integrity scoring and behavioral analysis",
      icon: "📊",
      color: "#3B82F6"
    }
  ];

  const testimonials = [
    {
      name: "Dr. Sarah Johnson",
      role: "Dean of Academic Affairs, Stanford University",
      text: "This system has revolutionized how we conduct online exams. The cheating detection accuracy is remarkable.",
      avatar: "👩‍🎓",
      rating: 5
    },
    {
      name: "Prof. Michael Chen",
      role: "Director of Online Education, MIT",
      text: "The most comprehensive exam monitoring solution we've implemented. The dashboard is intuitive and powerful.",
      avatar: "👨‍🏫",
      rating: 5
    },
    {
      name: "Emily Rodriguez",
      role: "Student, Harvard University",
      text: "While it ensures exam integrity, the system is respectful of privacy and doesn't feel intrusive.",
      avatar: "👩‍💻",
      rating: 4
    }
  ];

  const institutions = [
    { name: "Stanford", logo: "🎓" },
    { name: "MIT", logo: "🔬" },
    { name: "Harvard", logo: "📚" },
    { name: "Oxford", logo: "🏛️" },
    { name: "Cambridge", logo: "⚔️" },
    { name: "Yale", logo: "🐶" }
  ];

  return (
    <div className="home-container">
      {/* Animated Background Elements */}
      <div className="animated-bg">
        <div className="floating-circle circle-1"></div>
        <div className="floating-circle circle-2"></div>
        <div className="floating-circle circle-3"></div>
        <div className="floating-circle circle-4"></div>
      </div>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <div className="badge">
              <span className="pulse-dot"></span>
              Trusted by 350+ Institutions Worldwide
            </div>
            <h1>
              <span className="text-gradient">Next-Generation</span> Exam 
              <span className="text-gradient"> Proctoring</span> Solution
            </h1>
            <p>Advanced AI-powered surveillance technology to ensure academic integrity during online examinations with military-grade security</p>
            <div className="hero-buttons">
              <a href="/exam" className="btn-primary">
                <span className="btn-icon">🎓</span>
                Take Exam
              </a>
              <a href="/results" className="btn-secondary">
                <span className="btn-icon">📊</span>
                Check Results
              </a>
            </div>
            <div className="hero-stats">
              <div className="mini-stat">
                <span className="mini-stat-value">98.7%</span>
                <span className="mini-stat-label">Detection Accuracy</span>
              </div>
              <div className="mini-stat">
                <span className="mini-stat-value">&lt;200ms</span>
                <span className="mini-stat-label">Real-time Alerts</span>
              </div>
              <div className="mini-stat">
                <span className="mini-stat-value">100%</span>
                <span className="mini-stat-label">GDPR Compliant</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="dashboard-preview">
              <div className="preview-header">
                <div className="preview-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div className="preview-title">Live Monitoring Dashboard</div>
                <div className="connection-status">
                  <span className="status-indicator"></span>
                  Live
                </div>
              </div>
              <div className="preview-content">
                <div className="preview-sidebar">
                  <div className="sidebar-item active">
                    <span className="sidebar-icon">📊</span> Dashboard
                  </div>
                  <div className="sidebar-item">
                    <span className="sidebar-icon">📝</span> Exams
                  </div>
                  <div className="sidebar-item">
                    <span className="sidebar-icon">⚠️</span> Alerts
                  </div>
                  <div className="sidebar-item">
                    <span className="sidebar-icon">📈</span> Reports
                  </div>
                </div>
                <div className="preview-main">
                  <div className="preview-stats">
                    <div className="stat-box">
                      <div className="stat-value">12</div>
                      <div className="stat-label">Active Exams</div>
                    </div>
                    <div className="stat-box warning">
                      <div className="stat-value">3</div>
                      <div className="stat-label">Flagged Sessions</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-value">284</div>
                      <div className="stat-label">Students</div>
                    </div>
                  </div>
                  <div className="preview-chart">
                    {[60, 40, 80, 30, 75, 65].map((height, index) => (
                      <div 
                        key={index} 
                        className="chart-bar" 
                        style={{height: `${height}%`}}
                      ></div>
                    ))}
                  </div>
                  <div className="live-feed">
                    <div className="feed-header">
                      <span>Live Feed</span>
                      <div className="recording-indicator">
                        <span className="recording-dot"></span>
                        Recording
                      </div>
                    </div>
                    <div className="feed-content">
                      <div className="student-feed">
                        <div className="webcam-feed"></div>
                        <div className="student-name">John D.</div>
                      </div>
                      <div className="student-feed">
                        <div className="webcam-feed"></div>
                        <div className="student-name">Sarah M.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-features">
          <div className="feature-tag">
            <span className="feature-icon">🔍</span>
            AI-Powered Detection
          </div>
          <div className="feature-tag">
            <span className="feature-icon">⚡</span>
            Real-time Monitoring
          </div>
          <div className="feature-tag">
            <span className="feature-icon">🛡️</span>
            Military-Grade Security
          </div>
          <div className="feature-tag">
            <span className="feature-icon">📊</span>
            Detailed Analytics
          </div>
        </div>
      </section>

      {/* Promotional Banner */}
      <div className="promo-banner">
        <div className="promo-content">
          <div className="promo-text">
            <h3>Limited Time Offer</h3>
            <p>Get 20% off on annual plans. Start your free trial today!</p>
          </div>
          <button className="promo-btn">Claim Offer</button>
        </div>
      </div>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          <div className="stat-item">
            <div className="stat-icon">📝</div>
            <div className="stat-number">{stats.examsMonitored.toLocaleString()}+</div>
            <div className="stat-title">Exams Monitored</div>
          </div>
          <div className="stat-item">
            <div className="stat-icon">🏫</div>
            <div className="stat-number">{stats.institutions}+</div>
            <div className="stat-title">Institutions</div>
          </div>
          <div className="stat-item">
            <div className="stat-icon">🌎</div>
            <div className="stat-number">{stats.countries}+</div>
            <div className="stat-title">Countries</div>
          </div>
          <div className="stat-item">
            <div className="stat-icon">🎯</div>
            <div className="stat-number">{stats.detectionAccuracy}%</div>
            <div className="stat-title">Detection Accuracy</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-header">
          <h2>Advanced Proctoring Features</h2>
          <p>Our comprehensive suite of monitoring tools ensures exam integrity across all digital environments</p>
        </div>
        
        <div className="features-container">
          <div className="features-nav">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`feature-nav-item ${currentFeature === index ? 'active' : ''}`}
                onClick={() => setCurrentFeature(index)}
                style={{borderLeftColor: features[currentFeature].color}}
              >
                <span className="feature-nav-icon">{feature.icon}</span>
                {feature.title}
                <span className="feature-indicator"></span>
              </div>
            ))}
          </div>
          
          <div className="features-display">
            <div className="feature-content">
              <h3>{features[currentFeature].title}</h3>
              <p>{features[currentFeature].description}</p>
              <button className="btn-outline">
                <span className="btn-icon">▶️</span>
                See it in action
              </button>
              <ul className="feature-benefits">
                <li>Real-time behavioral analysis</li>
                <li>Multi-factor authentication</li>
                <li>Customizable rule sets</li>
                <li>Automated incident reporting</li>
              </ul>
            </div>
            <div className="feature-visual">
              <div className="visual-container">
                <div 
                  className="demo-screen"
                  style={{background: `linear-gradient(135deg, ${features[currentFeature].color}, ${features[currentFeature].color}99)`}}
                >
                  {features[currentFeature].icon}
                </div>
                <div className="demo-controls">
                  <button className="control-btn">▶️</button>
                  <div className="demo-progress">
                    <div className="progress-bar"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="process-section">
        <div className="section-header">
          <h2>How It Works</h2>
          <p>Simple integration and seamless exam monitoring process</p>
        </div>
        
        <div className="process-steps">
          <div className="process-step">
            <div className="step-number">1</div>
            <div className="step-icon">📋</div>
            <h3>Exam Configuration</h3>
            <p>Set up exam parameters, rules, and monitoring preferences in minutes</p>
          </div>
          <div className="process-step">
            <div className="step-number">2</div>
            <div className="step-icon">👤</div>
            <h3>Identity Verification</h3>
            <p>AI-powered facial recognition and ID verification ensure test-taker authenticity</p>
          </div>
          <div className="process-step">
            <div className="step-number">3</div>
            <div className="step-icon">👁️</div>
            <h3>Live Monitoring</h3>
            <p>Real-time tracking of behavior, environment, and computer activity</p>
          </div>
          <div className="process-step">
            <div className="step-number">4</div>
            <div className="step-icon">📈</div>
            <h3>Comprehensive Reporting</h3>
            <p>Detailed analytics with integrity scoring and behavioral insights</p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="section-header">
          <h2>Trusted by Educational Institutions Worldwide</h2>
          <p>Join 350+ universities and schools that use ExamSecure</p>
        </div>
        
        <div className="testimonials-container">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="testimonial-card">
              <div className="testimonial-content">
                <div className="quote-mark">"</div>
                <p>{testimonial.text}</p>
                <div className="rating">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < testimonial.rating ? 'star filled' : 'star'}>
                      {i < testimonial.rating ? '★' : '☆'}
                    </span>
                  ))}
                </div>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">{testimonial.avatar}</div>
                <div className="author-info">
                  <div className="author-name">{testimonial.name}</div>
                  <div className="author-role">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="logos-section">
          <div className="logos-title">Trusted by leading institutions</div>
          <div className="logos-container">
            {institutions.map((institution, index) => (
              <div key={index} className="logo-item">
                <span className="logo-icon">{institution.logo}</span>
                <span>{institution.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Student Guide Section */}
      <section className="student-guide-section">
        <div className="section-header">
          <h2>📚 Student Access Guide</h2>
          <p>New to the system? Learn how to access your exams easily</p>
        </div>
        <StudentLoginGuide />
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Ready to Transform Your Exam Experience?</h2>
          <p>Join thousands of educators who have revolutionized their assessment process with ExamSecure</p>
          <div className="cta-buttons">
            <button className="btn-primary">Get Started Today</button>
            <button className="btn-secondary">Schedule a Demo</button>
          </div>
          <div className="cta-features">
            <div className="cta-feature">
              <span className="cta-icon">✅</span>
              <span>No credit card required</span>
            </div>
            <div className="cta-feature">
              <span className="cta-icon">✅</span>
              <span>Free 14-day trial</span>
            </div>
            <div className="cta-feature">
              <span className="cta-icon">✅</span>
              <span>Setup in minutes</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>ExamSecure</h3>
            <p>Advanced AI-powered examination monitoring system ensuring academic integrity and fairness.</p>
            <div className="social-links">
              <a href="#" aria-label="Facebook">📘</a>
              <a href="#" aria-label="Twitter">🐦</a>
              <a href="#" aria-label="LinkedIn">👔</a>
              <a href="#" aria-label="Instagram">📸</a>
            </div>
          </div>
          
          <div className="footer-section">
            <h4>Product</h4>
            <ul>
              <li><a href="#">Features</a></li>
              <li><a href="#">Pricing</a></li>
              <li><a href="#">Use Cases</a></li>
              <li><a href="#">Demo</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Resources</h4>
            <ul>
              <li><a href="#">Documentation</a></li>
              <li><a href="#">API</a></li>
              <li><a href="#">Help Center</a></li>
              <li><a href="#">Blog</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Company</h4>
            <ul>
              <li><a href="#">About Us</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Privacy Policy</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Contact Info</h4>
            <div className="contact-info">
              <p>📧 support@examsecure.com</p>
              <p>📞 +1 (555) 123-4567</p>
              <p>🏢 123 Education Ave, Academic City</p>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; 2023 ExamSecure. All rights reserved.</p>
          <div className="footer-links">
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Cookie Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;