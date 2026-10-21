Act as a Principal Interaction Designer. Audit this UI and implement comprehensive micro-interactions and strict state management. Do not leave any element static. For every interactive component, explicitly define and code:
- Pressed/Active states (scale down slightly to 0.98 for mobile tactility, shift alpha values).
- Focus states with high-contrast, accessible rings.
- Loading states featuring custom, minimal shimmer/skeleton effects (avoid generic spinning wheels).
- Empty, error, and success states that transition smoothly using subtle CSS/Framer Motion animations.
Ensure functional mobile tap targets are a minimum of 44x44pt.
Refactor this interface to avoid generic AI-generated design clichés (e.g., center-aligned feature blocks, bright purple gradients, and basic card grids). Instead, build a premium, visually distinct aesthetic using these rules:
- Asymmetry & Hierarchy: Use an editorial layout with high-contrast font weights, off-center alignments, and intentional "breathing room" (generous, mathematical padding).
- Surface Depth: Use a strict, layered surface architecture (e.g., base background, elevated card surfaces using minute 1px translucent borders with alpha values like `rgba(255,255,255,0.05)`, and explicit box-shadows).
- Iconography: Use clean, unified SVG iconography (e.g., Lucide or Heroicons). Do not use emojis as functional UI accents.
Scan the codebase for technical debt affecting perceived rendering performance and fluidity.
- Identify and remove unused CSS classes, redundant utility functions, and bloated JavaScript logic.
- Ensure all animations use hardware-accelerated properties (`transform`, `opacity`) instead of triggering layout paints (`width`, `height`, `top`).
- Implement proper image/asset lazy loading and component code-splitting to ensure immediate, snappy interaction response times.
Let's fine-tune the layout using visual diagnostic dials. Please adjust the current implementation along these axes:
- Airiness: Turn the dial up. Increase the vertical padding and letter-spacing slightly to give the content more breathing room.
- Subtlety: Turn the dial down on borders and colors. Soften hard borders to low-contrast dividers and switch stark solid blacks/whites to deeply saturated, softer off-tones.
- Fluidity: Add a standard transition duration token (e.g., `transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`) to all hover, active, and state changes so they glide rather than snap.

# Design System Tokens - Mobile PWA

## Colors & Surfaces
- Surface Base (`--bg-base`): #090A0F
- Surface Elevated (`--bg-surface`): #13151D
- Surface Card (`--bg-card`): #181B24
- Border Subtle (`--border-subtle`): rgba(255, 255, 255, 0.06)
- Border Focus (`--border-focus`): rgba(99, 102, 241, 0.8)
- Text Primary (`--text-main`): #F1F5F9
- Text Muted (`--text-muted`): #94A3B8
- Accent Core (`--accent`): #6366F1

## Typography & Spacing (Airiness Dial: High)
- Font Family: Inter, -apple-system, BlinkMacSystemFont, sans-serif
- Base Letter Spacing: -0.01em
- Heading Letter Spacing: -0.025em
- Spacing Scale: 4px base (Padding multiplier: generous, mathematical increments of 16px/24px)

## Motion & Tactility
- Standard Transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)
- Active Touch Scale: scale(0.98)
- Minimum Tap Target: 44x44pt
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Editorial PWA Workspace</title>
    <style>
        :root {
            --bg-base: #090A0F;
            --bg-surface: #13151D;
            --bg-card: #181B24;
            --border-subtle: rgba(255, 255, 255, 0.06);
            --border-focus: rgba(99, 102, 241, 0.8);
            --text-main: #F1F5F9;
            --text-muted: #94A3B8;
            --accent: #6366F1;
            --accent-glow: rgba(99, 102, 241, 0.15);
            --transition-smooth: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            background-color: var(--bg-base);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
            letter-spacing: -0.01em;
            padding: 24px 20px;
            display: flex;
            justify-content: center;
            min-height: 100vh;
        }

        .app-container {
            width: 100%;
            max-width: 480px; /* Optimized mobile viewport frame constraint */
            display: flex;
            flex-direction: column;
            gap: 32px;
        }

        /* Editorial Header - Off-center alignment with breathing room */
        header {
            padding-top: 16px;
        }

        .eyebrow {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: var(--text-muted);
            margin-bottom: 8px;
        }

        h1 {
            font-size: 28px;
            font-weight: 600;
            letter-spacing: -0.025em;
            color: var(--text-main);
            line-height: 1.2;
        }

        /* Layered Surface Architecture */
        .editorial-card {
            background-color: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            transition: var(--transition-smooth);
            position: relative;
            overflow: hidden;
        }

        .editorial-card:hover {
            border-color: rgba(255, 255, 255, 0.12);
        }

        /* Strict Micro-Interactions & Accessible Focus */
        .interactive-element {
            min-height: 44px;
            min-width: 44px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background-color: var(--bg-card);
            color: var(--text-main);
            border: 1px solid var(--border-subtle);
            border-radius: 12px;
            padding: 0 20px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: var(--transition-smooth);
            will-change: transform, opacity, background-color;
        }

        .interactive-element:hover {
            background-color: rgba(255, 255, 255, 0.04);
            border-color: rgba(255, 255, 255, 0.1);
        }

        .interactive-element:active {
            transform: scale(0.98);
        }

        .interactive-element:focus-visible {
            outline: none;
            border-color: var(--border-focus);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }

        /* Custom Minimal Shimmer / Skeleton Loading State */
        .skeleton {
            background: linear-gradient(90deg, var(--bg-card) 25%, rgba(255, 255, 255, 0.04) 50%, var(--bg-card) 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite linear;
            border-radius: 8px;
        }

        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        .skeleton-text {
            height: 14px;
            width: 75%;
            margin-bottom: 8px;
        }

        .skeleton-text.short {
            width: 40%;
        }

        /* State management display classes */
        .state-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        .hidden {
            display: none !important;
        }

        /* Success & Error Feedback Micro-States */
        .feedback-banner {
            padding: 12px 16px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 500;
            opacity: 0;
            transform: translateY(-4px);
            transition: var(--transition-smooth);
        }

        .feedback-banner.show {
            opacity: 1;
            transform: translateY(0);
        }

        .feedback-banner.success {
            background-color: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.2);
            color: #34D399;
        }

        .feedback-banner.error {
            background-color: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            color: #F87171;
        }
    </style>
</head>
<body>

    <div class="app-container">
        <!-- Editorial Header -->
        <header>
            <div class="eyebrow">Workspace Core</div>
            <h1>System Diagnostics</h1>
        </header>

        <!-- Main Interactive Surface Card -->
        <main class="editorial-card">
            <div id="content-view" class="state-container">
                <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">
                    Monitor pipeline latency, review hardware-accelerated asset bundles, and dispatch execution sync routines.
                </p>
                <div style="display: flex; gap: 12px; margin-top: 8px;">
                    <button class="interactive-element" id="action-trigger" onclick="handleAction()">
                        Run Sync Protocol
                    </button>
                </div>
            </div>

            <!-- Skeleton Loading State Template (Hidden by default) -->
            <div id="loading-view" class="state-container hidden">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
            </div>

            <!-- Dynamic Feedback Alert -->
            <div id="feedback" class="feedback-banner hidden" style="margin-top: 16px;"></div>
        </main>
    </div>

    <script>
        // High-performance state transitions avoiding layout paints
        function handleAction() {
            const content = document.getElementById('content-view');
            const loading = document.getElementById('loading-view');
            const feedback = document.getElementById('feedback');
            
            // Transition to loading state
            content.classList.add('hidden');
            loading.classList.remove('hidden');
            feedback.classList.remove('show', 'success', 'error');
            feedback.classList.add('hidden');

            // Simulate backend Python API asynchronous sync call
            setTimeout(() => {
                loading.classList.add('hidden');
                content.classList.remove('hidden');
                
                // Trigger Success State with smooth CSS frame interpolation
                feedback.textContent = 'Sync protocol completed successfully.';
                feedback.classList.remove('hidden', 'error');
                feedback.classList.add('success', 'show');

                // Auto-dismiss feedback after 3 seconds
                setTimeout(() => {
                    feedback.classList.remove('show');
                }, 3000);
            }, 1200);
        }
    </script>
</body>
</html>

from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def index():
    # Renders the fine-tuned editorial PWA interface template
    return render_template("index.html")

@app.route("/api/sync", methods=["POST"])
def api_sync():
    # Placeholder endpoint for handling background async actions
    return {"status": "success", "message": "Protocol sequence verified."}, 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)