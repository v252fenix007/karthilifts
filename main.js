/**
 * KAARTHI LIFTS - INTERACTIVE LOGIC & SCROLL CANVAS ENGINE
 */

document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------------------------
    // 1. CANVAS HERO ENGINE
    // --------------------------------------------------------------------------
    const FRAME_COUNT = 240;
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    const context = canvas.getContext('2d');
    const images = [];
    let imagesLoadedCount = 0;
    let fallbackImage = null;
    let currentFrameIndex = 0;
    let currentScrollFraction = 0;

    // Pad number: 1 -> "001"
    const currentFrame = (index) => 
        `images/ezgif-frame-${(index + 1).toString().padStart(3, '0')}.jpg`;

    // Load hero-frame fallback image in case full 240-frame sequence isn't fully placed yet
    const initFallback = () => {
        const fallback = new Image();
        fallback.src = 'images/hero-frame.jpg';
        fallback.onload = () => {
            fallbackImage = fallback;
            if (!images[currentFrameIndex] || !images[currentFrameIndex].complete) {
                renderFrame(currentFrameIndex);
            }
        };
    };
    initFallback();

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        renderFrame(currentFrameIndex);
    }

    function renderFrame(index) {
        let img = images[index];

        // Find nearest loaded frame if current frame is not loaded
        if (!img || !img.complete || img.naturalWidth === 0) {
            for (let i = index; i >= 0; i--) {
                if (images[i] && images[i].complete && images[i].naturalWidth !== 0) {
                    img = images[i];
                    break;
                }
            }
            if (!img && fallbackImage && fallbackImage.complete) {
                img = fallbackImage;
            }
        }

        context.clearRect(0, 0, canvas.width, canvas.height);

        if (img && img.complete && img.naturalWidth !== 0) {
            // Emulate CSS object-fit: cover with smooth cinematic scroll zoom
            const zoom = 1.0 + (currentScrollFraction * 0.20);
            const hRatio = (canvas.width / img.width) * zoom;
            const vRatio = (canvas.height / img.height) * zoom;
            const ratio = Math.max(hRatio, vRatio);
            
            // Center framing tuned for athlete & small textline
            const focalX = 0.54;
            const centerShift_x = (canvas.width - img.width * ratio) * focalX;
            const centerShift_y = (canvas.height - img.height * ratio) * 0.5 - (currentScrollFraction * 35);

            context.drawImage(
                img,
                0, 0, img.width, img.height,
                centerShift_x, centerShift_y, img.width * ratio, img.height * ratio
            );
        } else {
            // Atmospheric canvas fallback if no images are loaded yet
            const gradient = context.createRadialGradient(
                canvas.width / 2, canvas.height / 3, 50,
                canvas.width / 2, canvas.height / 2, canvas.width
            );
            gradient.addColorStop(0, '#222226');
            gradient.addColorStop(0.5, '#111114');
            gradient.addColorStop(1, '#050505');
            context.fillStyle = gradient;
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // Preload frames progressively
    function preloadImages() {
        // Step 1: Load Frame 1 immediately
        const img1 = new Image();
        img1.src = currentFrame(0);
        img1.onload = () => {
            images[0] = img1;
            imagesLoadedCount++;
            resizeCanvas();
            startBackgroundLoading();
        };
        img1.onerror = () => {
            // If ezgif-frame-001 is missing, try fallback
            startBackgroundLoading();
        };

        function startBackgroundLoading() {
            let nextFrame = 1;
            const CHUNK_SIZE = 12;

            function loadChunk(deadline) {
                while (
                    (deadline.timeRemaining() > 0 || deadline.didTimeout) &&
                    nextFrame < FRAME_COUNT
                ) {
                    const limit = Math.min(nextFrame + CHUNK_SIZE, FRAME_COUNT);
                    for (let i = nextFrame; i < limit; i++) {
                        const img = new Image();
                        img.src = currentFrame(i);
                        img.onload = () => { imagesLoadedCount++; };
                        img.onerror = () => { /* quiet fallback to nearest frame */ };
                        images[i] = img;
                    }
                    nextFrame = limit;
                }

                if (nextFrame < FRAME_COUNT) {
                    if ('requestIdleCallback' in window) {
                        requestIdleCallback(loadChunk);
                    } else {
                        setTimeout(() => loadChunk({ timeRemaining: () => 50, didTimeout: true }), 150);
                    }
                }
            }

            if ('requestIdleCallback' in window) {
                requestIdleCallback(loadChunk);
            } else {
                setTimeout(() => loadChunk({ timeRemaining: () => 50, didTimeout: true }), 150);
            }
        }
    }

    window.addEventListener('resize', resizeCanvas);
    preloadImages();
    resizeCanvas();

    // --------------------------------------------------------------------------
    // 2. SCROLL ENGINE & HUD
    // --------------------------------------------------------------------------
    const scrollContainer = document.querySelector('.scroll-container');
    const hudBar = document.getElementById('hud-bar');
    const hudPercent = document.getElementById('hud-percent');
    const scrollHint = document.getElementById('scroll-hint');
    const heroHeadline = document.getElementById('hero-center-headline');
    const box1 = document.getElementById('box1');
    const box2 = document.getElementById('box2');
    const box3 = document.getElementById('box3');
    const navbar = document.getElementById('site-nav');

    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const scrollTop = window.scrollY || document.documentElement.scrollTop;
                
                // Navbar appearance on scroll
                if (scrollTop > 80) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }

                if (scrollTop > 120 && scrollHint) {
                    scrollHint.style.opacity = '0';
                    scrollHint.style.transition = 'opacity 0.4s ease';
                }

                // Calculate scroll fraction for the 800vh hero
                const containerHeight = scrollContainer.offsetHeight;
                const maxScroll = containerHeight - window.innerHeight;
                
                if (maxScroll > 0) {
                    const scrollFraction = Math.max(0, Math.min(1, scrollTop / maxScroll));
                    currentScrollFraction = scrollFraction;

                    // Map scroll to frame
                    const frameIndex = Math.min(
                        FRAME_COUNT - 1,
                        Math.floor(scrollFraction * FRAME_COUNT)
                    );

                    if (frameIndex !== currentFrameIndex) {
                        currentFrameIndex = frameIndex;
                        renderFrame(frameIndex);
                    }

                    // Update HUD
                    if (hudBar) {
                        hudBar.style.width = `${(scrollFraction * 100).toFixed(1)}%`;
                    }
                    if (hudPercent) {
                        hudPercent.textContent = `${Math.round(scrollFraction * 100)}%`;
                    }

                    // Update Text Boxes
                    if (box1) box1.classList.toggle('active', scrollFraction >= 0.14 && scrollFraction <= 0.34);
                    if (box2) box2.classList.toggle('active', scrollFraction >= 0.40 && scrollFraction <= 0.60);
                    if (box3) box3.classList.toggle('active', scrollFraction >= 0.66 && scrollFraction <= 0.88);

                    // Center White & Yellow Headline - smooth scroll dissolve and return
                    if (heroHeadline) {
                        if (scrollFraction <= 0.12) {
                            const prog = scrollFraction / 0.10;
                            const opacity = Math.max(0, 1 - prog);
                            const translateY = -prog * 35;
                            const scale = 1 - prog * 0.08;
                            heroHeadline.style.opacity = opacity.toFixed(3);
                            heroHeadline.style.transform = `translate(-50%, calc(-50% + ${translateY.toFixed(1)}px)) scale(${scale.toFixed(3)})`;
                            heroHeadline.style.visibility = opacity > 0.02 ? 'visible' : 'hidden';
                        } else {
                            heroHeadline.style.opacity = '0';
                            heroHeadline.style.visibility = 'hidden';
                        }
                    }
                }

                ticking = false;
            });
            ticking = true;
        }
    });

    // --------------------------------------------------------------------------
    // 3. STATS NUMBER COUNTER (INTERSECTION OBSERVER)
    // --------------------------------------------------------------------------
    const statCounters = document.querySelectorAll('.stat-number');
    let counted = false;

    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !counted) {
                counted = true;
                statCounters.forEach(counter => {
                    const target = parseInt(counter.getAttribute('data-target'), 10);
                    const suffix = counter.getAttribute('data-suffix') || '';
                    let current = 0;
                    const duration = 1800; // ms
                    const stepTime = 25;
                    const increment = Math.max(1, Math.ceil(target / (duration / stepTime)));

                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) {
                            counter.innerHTML = `${target}<span>${suffix}</span>`;
                            clearInterval(timer);
                        } else {
                            counter.innerHTML = `${current}<span>${suffix}</span>`;
                        }
                    }, stepTime);
                });
            }
        });
    }, { threshold: 0.3 });

    const statsSection = document.querySelector('.stats-counter-strip');
    if (statsSection) {
        statsObserver.observe(statsSection);
    }

    // --------------------------------------------------------------------------
    // 4. FAQ ACCORDION
    // --------------------------------------------------------------------------
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const questionBtn = item.querySelector('.faq-question');
        questionBtn.addEventListener('click', () => {
            const isOpen = item.classList.contains('open');
            // Close other items
            faqItems.forEach(other => other.classList.remove('open'));
            // Toggle current item
            if (!isOpen) {
                item.classList.add('open');
            }
        });
    });

    // --------------------------------------------------------------------------
    // 5. MOBILE MENU TOGGLE
    // --------------------------------------------------------------------------
    const mobileToggle = document.getElementById('mobile-toggle');
    const navLinks = document.getElementById('nav-links');

    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('mobile-active');
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('mobile-active');
            });
        });
    }

    // Plan selection sync from pricing cards
    const planButtons = document.querySelectorAll('.select-plan-btn');
    const planSelect = document.getElementById('client-plan');
    if (planButtons.length && planSelect) {
        planButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const chosenPlan = btn.getAttribute('data-plan');
                if (chosenPlan) {
                    planSelect.value = chosenPlan;
                }
            });
        });
    }

    // --------------------------------------------------------------------------
    // 6. REAL-TIME SOCKET.IO & FULLSTACK REAL-TIME ENGINE
    // --------------------------------------------------------------------------
    let socket = null;
    let attachedMacroProfile = null;
    let clientSessionId = localStorage.getItem('kl_chat_session');
    if (!clientSessionId) {
        clientSessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        localStorage.setItem('kl_chat_session', clientSessionId);
    }

    // Ribbon & HUD Elements
    const ribbonBatchName = document.getElementById('ribbon-batch-name');
    const ribbonSlotsCount = document.getElementById('ribbon-slots-count');
    const ribbonCoachStatus = document.getElementById('ribbon-coach-status');
    const ribbonVisitorCount = document.getElementById('ribbon-visitor-count');
    const pricingBatchName = document.getElementById('pricing-batch-name');
    const pricingSlotsCount = document.getElementById('pricing-slots-count');
    const pricingTotalSlots = document.getElementById('pricing-total-slots');
    const pricingSlotsBar = document.getElementById('pricing-slots-bar');
    const widgetCoachStatus = document.getElementById('widget-coach-status');

    // Initialize Socket.io
    if (typeof io !== 'undefined') {
        socket = io();

        socket.on('connect', () => {
            socket.emit('join_public');
            socket.emit('chat:join', { sessionId: clientSessionId, senderName: 'Prospective Athlete' });
        });

        // 1. Live Active Visitors update
        socket.on('presence:count', (data) => {
            if (ribbonVisitorCount) ribbonVisitorCount.textContent = data.count;
        });

        // 2. Real-Time Stats & Slots update
        socket.on('stats:updated', (stats) => {
            updatePublicStats(stats);
        });

        // 3. Real-Time Chat Message from Coach Kaarthi
        socket.on('chat:message', (msg) => {
            if (msg.sender === 'coach') {
                appendClientChatBubble(msg.text, 'from-coach', msg.created_at);
                // If chat is closed, wiggle/pulse trigger button
                const popup = document.getElementById('chat-popup-window');
                if (popup && popup.style.display === 'none') {
                    const btn = document.getElementById('chat-trigger-btn');
                    if (btn) {
                        btn.style.boxShadow = '0 0 25px rgba(226, 183, 85, 0.9)';
                        btn.style.transform = 'scale(1.08)';
                        setTimeout(() => {
                            btn.style.boxShadow = '';
                            btn.style.transform = '';
                        }, 2000);
                    }
                }
            }
        });

        // 4. Typing status from Coach
        socket.on('chat:typing', ({ sender, isTyping }) => {
            if (sender === 'coach') {
                const typingEl = document.getElementById('chat-typing-status');
                if (typingEl) typingEl.style.display = isTyping ? 'block' : 'none';
            }
        });
    }

    function updatePublicStats(stats) {
        if (!stats) return;
        if (ribbonBatchName) ribbonBatchName.textContent = stats.batchName;
        if (ribbonSlotsCount) ribbonSlotsCount.textContent = stats.slotsRemaining;
        if (ribbonCoachStatus) ribbonCoachStatus.textContent = stats.coachStatus;
        if (widgetCoachStatus) widgetCoachStatus.textContent = stats.coachStatus.includes('Online') ? 'Online • Instant Reply' : stats.coachStatus;

        if (pricingBatchName) pricingBatchName.textContent = stats.batchName;
        if (pricingSlotsCount) pricingSlotsCount.textContent = stats.slotsRemaining;
        if (pricingTotalSlots) pricingTotalSlots.textContent = stats.totalSlots;

        if (pricingSlotsBar && stats.totalSlots > 0) {
            const filledPercent = Math.min(100, Math.max(10, ((stats.totalSlots - stats.slotsRemaining) / stats.totalSlots) * 100));
            pricingSlotsBar.style.width = `${filledPercent}%`;
        }
    }

    // --------------------------------------------------------------------------
    // 7. INTERACTIVE MACRO & CALORIE CALCULATOR
    // --------------------------------------------------------------------------
    const calcWeight = document.getElementById('calc-weight');
    const calcHeight = document.getElementById('calc-height');
    const calcGoal = document.getElementById('calc-target-goal');
    const calcActivity = document.getElementById('calc-activity');
    const calcResCalories = document.getElementById('calc-res-calories');
    const calcResProtein = document.getElementById('calc-res-protein');
    const calcResCarbs = document.getElementById('calc-res-carbs');
    const calcResFats = document.getElementById('calc-res-fats');
    const btnAttachMacro = document.getElementById('btn-attach-macro');
    const macroAttachedBadge = document.getElementById('macro-attached-badge');

    function calculateMacros() {
        if (!calcWeight || !calcHeight || !calcGoal || !calcActivity) return;

        const weight = parseFloat(calcWeight.value) || 75;
        const height = parseFloat(calcHeight.value) || 175;
        const goal = calcGoal.value;
        const activity = calcActivity.value;

        // Mifflin-St Jeor Formula
        const bmr = (10 * weight) + (6.25 * height) - (5 * 26) + 5;
        let mult = 1.45;
        if (activity === 'light') mult = 1.30;
        if (activity === 'heavy') mult = 1.65;

        let tdee = bmr * mult;
        let calories = tdee;
        let proteinPerKg = 2.0;

        if (goal === 'cut') {
            calories = tdee * 0.80; // 20% deficit
            proteinPerKg = 2.2;
        } else if (goal === 'bulk') {
            calories = tdee * 1.12; // 12% clean surplus
            proteinPerKg = 2.0;
        } else {
            calories = tdee; // Maintenance recomp
            proteinPerKg = 2.1;
        }

        calories = Math.round(calories);
        const protein = Math.round(weight * proteinPerKg);
        const fats = Math.round((calories * 0.25) / 9);
        const carbs = Math.max(50, Math.round((calories - (protein * 4) - (fats * 9)) / 4));

        if (calcResCalories) calcResCalories.textContent = calories.toLocaleString();
        if (calcResProtein) calcResProtein.textContent = `${protein}g`;
        if (calcResCarbs) calcResCarbs.textContent = `${carbs}g`;
        if (calcResFats) calcResFats.textContent = `${fats}g`;

        attachedMacroProfile = {
            calories,
            protein,
            carbs,
            fats,
            goalLabel: goal === 'cut' ? 'Fat Loss & Shred' : (goal === 'bulk' ? 'Lean Muscle Bulk' : 'Body Recomposition')
        };
    }

    [calcWeight, calcHeight, calcGoal, calcActivity].forEach(el => {
        if (el) el.addEventListener('input', calculateMacros);
    });
    calculateMacros();

    if (btnAttachMacro) {
        btnAttachMacro.addEventListener('click', () => {
            calculateMacros();
            if (macroAttachedBadge) {
                macroAttachedBadge.style.display = 'block';
            }

            // Sync goal dropdown in consultation form
            const clientGoal = document.getElementById('client-goal');
            if (clientGoal && attachedMacroProfile) {
                if (calcGoal.value === 'cut') clientGoal.value = 'Fat Loss & Shred';
                else if (calcGoal.value === 'bulk') clientGoal.value = 'Lean Muscle Bulk';
                else clientGoal.value = 'Body Recomposition';
            }

            // Smooth scroll to contact form
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                contactSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // --------------------------------------------------------------------------
    // 8. REAL-TIME CONSULTATION FORM SUBMISSION
    // --------------------------------------------------------------------------
    const contactForm = document.getElementById('contact-form');
    const formNotify = document.getElementById('form-notification');
    const whatsappDirectBtn = document.getElementById('whatsapp-direct-btn');

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '⚡ TRANSMITTING IN REAL-TIME...';
            }

            const name = document.getElementById('client-name').value.trim();
            const age = document.getElementById('client-age').value.trim();
            const gender = document.getElementById('client-gender').value;
            const phone = document.getElementById('client-phone').value.trim();
            const email = document.getElementById('client-email').value.trim();
            const instagram = document.getElementById('client-instagram')?.value.trim() || '';
            const occupation = document.getElementById('client-occupation').value;
            const workout_time = document.getElementById('client-workout-time').value;
            const goal = document.getElementById('client-goal').value;
            const plan = document.getElementById('client-plan')?.value || 'Momentum (8 Weeks)';
            const budget = document.getElementById('client-budget').value;
            const payment_method = document.getElementById('client-payment').value;
            const struggles = document.getElementById('client-struggles').value.trim();

            const payload = {
                name,
                age,
                gender,
                phone,
                email,
                instagram,
                occupation,
                workout_time,
                goal,
                plan,
                budget,
                payment_method,
                struggles,
                macro_profile: attachedMacroProfile
            };

            try {
                const response = await fetch('/api/leads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (data.success && data.lead) {
                    const lead = data.lead;
                    localStorage.setItem('kl_last_ref', lead.ref_code);

                    if (formNotify) {
                        formNotify.className = 'form-notification success';
                        formNotify.style.display = 'block';
                        formNotify.innerHTML = `
                            <div style="padding: 0.5rem 0;">
                                <h4 style="color: var(--primary-gold); margin-bottom: 0.3rem;">⚡ CONSULTATION REGISTERED IN REAL-TIME!</h4>
                                <p style="margin-bottom: 0.4rem;">Thank you, <strong>${escapeHtml(name)}</strong>! Your intake details for <strong>${escapeHtml(goal)}</strong> have been delivered directly to Coach Kaarthi.</p>
                                <div style="background: rgba(0,0,0,0.4); padding: 0.6rem 0.8rem; border-radius: 6px; font-family: var(--font-mono); font-size: 0.85rem; margin-bottom: 0.5rem;">
                                    Reference ID: <span style="color: var(--primary-gold-bright); font-weight: 700;">${lead.ref_code}</span> &bull; Status: <span style="color: #10b981;">New Application in Coach Queue</span>
                                </div>
                                <p style="font-size: 0.82rem; color: #a3a3a8;">Opening WhatsApp direct chat in 2 seconds...</p>
                            </div>
                        `;
                    }

                    // Compose detailed WhatsApp message
                    const waSummary = `Hi Coach Kaarthi! I just submitted my consultation application on Kaarthi Lifts.
Ref ID: ${lead.ref_code}
• Name: ${name} (Age: ${age}, ${gender})
• Routine: ${occupation}
• Availability: ${workout_time}
• Fitness Target: ${goal}
• Program: ${plan}
• Budget: ${budget}
• Payment Mode: ${payment_method}
• Key Struggles: "${struggles.substring(0, 100)}${struggles.length > 100 ? '...' : ''}"
Can we discuss my personalized roadmap?`;

                    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(waSummary)}`;

                    setTimeout(() => {
                        window.open(whatsappUrl, '_blank');
                    }, 2000);

                    contactForm.reset();
                } else {
                    throw new Error(data.error || 'Submission failed');
                }
            } catch (err) {
                if (formNotify) {
                    formNotify.className = 'form-notification error';
                    formNotify.style.display = 'block';
                    formNotify.textContent = 'Transmission error: ' + err.message + '. Please connect via WhatsApp directly.';
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            }
        });
    }

    if (whatsappDirectBtn) {
        whatsappDirectBtn.addEventListener('click', () => {
            const text = encodeURIComponent("Hi Kaarthi! I'm interested in training with Kaarthi Lifts. Can we connect?");
            window.open(`https://wa.me/?text=${text}`, '_blank');
        });
    }

    // --------------------------------------------------------------------------
    // 9. REAL-TIME APPLICATION STATUS TRACKER
    // --------------------------------------------------------------------------
    const openTrackerBtn = document.getElementById('open-tracker-btn');
    const trackerModal = document.getElementById('tracker-modal');
    const trackerModalClose = document.getElementById('tracker-modal-close');
    const trackerRefInput = document.getElementById('tracker-ref-input');
    const trackerSubmitBtn = document.getElementById('tracker-submit-btn');
    const trackerResult = document.getElementById('tracker-result');

    if (openTrackerBtn && trackerModal) {
        openTrackerBtn.addEventListener('click', () => {
            trackerModal.style.display = 'flex';
            const lastRef = localStorage.getItem('kl_last_ref');
            if (lastRef && trackerRefInput) trackerRefInput.value = lastRef;
        });

        if (trackerModalClose) {
            trackerModalClose.addEventListener('click', () => {
                trackerModal.style.display = 'none';
            });
        }

        trackerModal.addEventListener('click', (e) => {
            if (e.target === trackerModal) trackerModal.style.display = 'none';
        });

        if (trackerSubmitBtn) {
            trackerSubmitBtn.addEventListener('click', async () => {
                const ref = trackerRefInput.value.trim().toUpperCase();
                if (!ref) return;

                trackerSubmitBtn.textContent = 'Checking...';
                try {
                    const res = await fetch(`/api/leads/track/${ref}`);
                    const data = await res.json();

                    trackerResult.style.display = 'block';
                    if (data.success) {
                        const statusColors = {
                            new: '#e2b755',
                            contacted: '#38bdf8',
                            enrolled: '#10b981',
                            archived: '#64748b'
                        };
                        const statusLabels = {
                            new: 'Application Received & In Coach Queue',
                            contacted: 'Under Review / Initial Contact Initiated',
                            enrolled: 'Confirmed & Enrolled Athlete',
                            archived: 'Archived Application'
                        };

                        trackerResult.innerHTML = `
                            <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.3rem;">REF: ${data.ref_code}</div>
                            <h4 style="margin-bottom: 0.4rem; color: #fff;">Athlete: ${escapeHtml(data.name)}</h4>
                            <p style="font-size: 0.85rem; margin-bottom: 0.5rem;">Program: <strong>${escapeHtml(data.plan)}</strong></p>
                            <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.5); padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid ${statusColors[data.status] || '#e2b755'};">
                                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColors[data.status] || '#e2b755'}; display: inline-block;"></span>
                                <strong style="color: ${statusColors[data.status] || '#e2b755'};">${statusLabels[data.status] || data.status}</strong>
                            </div>
                        `;
                    } else {
                        trackerResult.innerHTML = `<p style="color: var(--accent-red);">${data.error || 'Reference ID not found.'}</p>`;
                    }
                } catch(e) {
                    trackerResult.style.display = 'block';
                    trackerResult.innerHTML = `<p style="color: var(--accent-red);">Unable to reach real-time server.</p>`;
                } finally {
                    trackerSubmitBtn.textContent = 'Check Status';
                }
            });
        }
    }

    // --------------------------------------------------------------------------
    // 10. REAL-TIME LIVE CHAT WIDGET ("ASK KAARTHI")
    // --------------------------------------------------------------------------
    const chatTriggerBtn = document.getElementById('chat-trigger-btn');
    const chatPopupWindow = document.getElementById('chat-popup-window');
    const chatCloseBtn = document.getElementById('chat-close-btn');
    const chatMessagesContainer = document.getElementById('chat-popup-messages');
    const clientChatForm = document.getElementById('client-chat-form');
    const clientChatInput = document.getElementById('client-chat-input');
    const quickChips = document.querySelectorAll('.chip-btn');

    if (chatTriggerBtn && chatPopupWindow) {
        chatTriggerBtn.addEventListener('click', () => {
            const isVisible = chatPopupWindow.style.display === 'flex';
            chatPopupWindow.style.display = isVisible ? 'none' : 'flex';
            if (!isVisible && clientChatInput) {
                clientChatInput.focus();
                // Load history if any
                fetch(`/api/chat/${clientSessionId}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data.history && data.history.length > 0) {
                            chatMessagesContainer.innerHTML = '';
                            data.history.forEach(m => appendClientChatBubble(m.text, m.sender === 'visitor' ? 'from-visitor' : 'from-coach', m.created_at));
                        }
                    })
                    .catch(() => {});
            }
        });

        if (chatCloseBtn) {
            chatCloseBtn.addEventListener('click', () => {
                chatPopupWindow.style.display = 'none';
            });
        }

        // Quick Chips
        quickChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const text = chip.getAttribute('data-text');
                if (text && clientChatInput) {
                    clientChatInput.value = text;
                    sendClientChatMessage(text);
                }
            });
        });

        // Typing event
        let typingTimeout = null;
        if (clientChatInput) {
            clientChatInput.addEventListener('input', () => {
                if (socket) {
                    socket.emit('chat:typing', { sessionId: clientSessionId, sender: 'visitor', isTyping: true });
                    clearTimeout(typingTimeout);
                    typingTimeout = setTimeout(() => {
                        socket.emit('chat:typing', { sessionId: clientSessionId, sender: 'visitor', isTyping: false });
                    }, 1200);
                }
            });
        }

        // Form Submit
        if (clientChatForm) {
            clientChatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const text = clientChatInput.value.trim();
                if (!text) return;
                sendClientChatMessage(text);
            });
        }
    }

    function sendClientChatMessage(text) {
        appendClientChatBubble(text, 'from-visitor', new Date().toISOString());
        if (clientChatInput) clientChatInput.value = '';

        if (socket && socket.connected) {
            socket.emit('chat:send', {
                sessionId: clientSessionId,
                sender: 'visitor',
                text: text,
                senderName: 'Prospective Athlete'
            });
        } else {
            // REST Fallback
            fetch(`/api/chat/${clientSessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender: 'visitor', text: text, sender_name: 'Prospective Athlete' })
            }).catch(() => {});
        }
    }

    function appendClientChatBubble(text, type, time) {
        if (!chatMessagesContainer) return;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble-client ${type}`;
        const timeStr = time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';

        bubble.innerHTML = `
            <p>${escapeHtml(text)}</p>
            <span class="msg-timestamp">${timeStr}</span>
        `;
        chatMessagesContainer.appendChild(bubble);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    // --------------------------------------------------------------------------
    // 11. REAL-TIME SOCIAL PROOF TOAST TICKER
    // --------------------------------------------------------------------------
    const socialToast = document.getElementById('social-proof-toast');
    const toastTitle = document.getElementById('toast-title');
    const toastTime = document.getElementById('toast-time');

    const sampleToasts = [
        { name: "Rahul S. (Bangalore)", program: "Elite 12-Week Transformation", time: "2 mins ago" },
        { name: "Priya M. (Chennai)", program: "Momentum 8-Week Hypertrophy", time: "11 mins ago" },
        { name: "Aditya V. (Mumbai)", program: "Aggressive Fat Loss Consultation", time: "24 mins ago" },
        { name: "Kiran R. (Hyderabad)", program: "Biomechanics & PR Coaching", time: "38 mins ago" }
    ];
    let toastIndex = 0;

    function triggerSocialToast() {
        if (!socialToast || !toastTitle) return;
        const item = sampleToasts[toastIndex % sampleToasts.length];
        toastTitle.innerHTML = `<strong>${item.name}</strong> applied for ${item.program}`;
        if (toastTime) toastTime.textContent = item.time;

        socialToast.style.display = 'flex';
        setTimeout(() => {
            socialToast.style.display = 'none';
        }, 5000);

        toastIndex++;
    }

    // Show first toast after 4 seconds, then every 35 seconds
    setTimeout(triggerSocialToast, 4000);
    setInterval(triggerSocialToast, 35000);

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});
