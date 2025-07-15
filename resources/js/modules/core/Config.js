export class Config {
    constructor() {
        this.apiBaseUrl = "http://builder.test/api";
        this.canvas = {
            defaultWidth: 595,
            defaultHeight: 842,
            minZoom: 0.25,
            maxZoom: 4,
            zoomStep: 0.25
        };
        this.snap = {
            enabled: true,
            threshold: 5
        };
        this.constraints = {
            minElementSize: 20,
            boundaryBuffer: 50
        };
        this.colors = {
            guideLines: "#00FFFF",
            defaultText: "#333333",
            defaultBackground: "#3498db",
            defaultBorder: "#2c3e50"
        };
    }

    async loadFromServer() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/config`);
            if (response.ok) {
                const config = await response.json();
                this.apiBaseUrl = config.api_base_url;
                console.log("Configuration loaded successfully. API Base URL:", this.apiBaseUrl);
            } else {
                console.warn("Failed to load configuration from server, using fallback URL:", this.apiBaseUrl);
            }
        } catch (error) {
            console.warn("Error loading configuration, using fallback URL:", this.apiBaseUrl, error);
        }
    }

    getFontStack(fontFamily) {
        const fontStacks = {
            Arial: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
            Helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            "Times-Roman": '"Times New Roman", Times, serif',
            Courier: '"Courier New", Courier, monospace',
            Nimbus: '"Nimbus Sans", "Liberation Sans", "Helvetica Neue", Helvetica, Arial, sans-serif'
        };
        return fontStacks[fontFamily] || fontStacks.Arial;
    }

    getDefaultElementData(type) {
        const base = {
            width: 100,
            height: 60,
            text: "",
            fontSize: 14,
            fontFamily: "Arial",
            textAlign: "left",
            lineHeight: 18,
            color: this.colors.defaultText,
            colorCmyk: this.hexToCmyk(this.colors.defaultText),
            colorMode: "hex",
            backgroundColor: this.colors.defaultBackground,
            backgroundColorCmyk: this.hexToCmyk(this.colors.defaultBackground),
            backgroundColorMode: "hex",
            borderColor: this.colors.defaultBorder,
            borderColorCmyk: this.hexToCmyk(this.colors.defaultBorder),
            borderColorMode: "hex",
            borderWidth: 1,
            opacity: 1,
            rotation: 0
        };

        const typeSpecific = {
            text: {
                text: "Sample Text",
                width: 120,
                height: 30,
                fontSize: 14
            },
            heading: {
                text: "Heading",
                width: 150,
                height: 40,
                fontSize: 20
            },
            rectangle: {
                width: 100,
                height: 60
            },
            circle: {
                width: 60,
                height: 60
            },
            line: {
                width: 100,
                height: 2
            },
            image: {
                width: 100,
                height: 100
            }
        };

        return { ...base, ...typeSpecific[type] };
    }

    // Color conversion utilities
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    rgbToCmyk(r, g, b) {
        r = r / 255;
        g = g / 255;
        b = b / 255;

        const k = 1 - Math.max(r, g, b);
        if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };

        const c = Math.round(((1 - r - k) / (1 - k)) * 100);
        const m = Math.round(((1 - g - k) / (1 - k)) * 100);
        const y = Math.round(((1 - b - k) / (1 - k)) * 100);
        const kPercent = Math.round(k * 100);

        return { c, m, y, k: kPercent };
    }

    hexToCmyk(hex) {
        const rgb = this.hexToRgb(hex);
        return this.rgbToCmyk(rgb.r, rgb.g, rgb.b);
    }

    cmykToRgb(c, m, y, k) {
        c = c / 100;
        m = m / 100;
        y = y / 100;
        k = k / 100;

        const r = Math.round(255 * (1 - c) * (1 - k));
        const g = Math.round(255 * (1 - m) * (1 - k));
        const b = Math.round(255 * (1 - y) * (1 - k));

        return { r, g, b };
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    cmykToHex(c, m, y, k) {
        const rgb = this.cmykToRgb(c, m, y, k);
        return this.rgbToHex(rgb.r, rgb.g, rgb.b);
    }
} 