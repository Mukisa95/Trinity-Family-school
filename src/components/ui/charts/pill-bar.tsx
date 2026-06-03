import * as React from "react";

export const VIBRANT_COLORS = [
    "#f39c12", // orange
    "#e84393", // pink
    "#3c40c6", // deep purple/blue
    "#0abde3", // light blue
    "#78e08f", // green
    "#8e44ad", // purple
    "#ff7675", // coral pink
    "#20bf6b", // emerald
];

export const PillBar = (props: any) => {
    const { fill, x, y, width, height: originalHeight, value, background } = props;

    if (width == null || originalHeight == null || background == null) return null;

    const radius = width / 2;

    // mathematical top is 'y', bottom is 'y + originalHeight'
    // To align the centers of the semi-circles with these values,
    // we must adjust the visual rectangle to start higher and end lower.
    const actualY = y - radius;
    const actualHeight = originalHeight + width;

    // Create a unique ID for gradients so they don't clash across bars
    const gradientId = `bar-gradient-${x}-${y}`;
    const sphereGradientId = `sphere-gradient-${x}-${y}`;

    return (
        <g>
            <defs>
                {/* Cylindrical gradient for the bar */}
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={fill} stopOpacity={0.7} />
                    <stop offset="30%" stopColor={fill} stopOpacity={1} />
                    <stop offset="70%" stopColor={fill} stopOpacity={1} />
                    <stop offset="100%" stopColor={fill} stopOpacity={0.6} />
                </linearGradient>

                {/* Spherical gradient for the thumb circle */}
                <radialGradient id={sphereGradientId} cx="35%" cy="30%" r="65%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
                    <stop offset="80%" stopColor="#f8fafc" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#e2e8f0" stopOpacity={0.9} />
                </radialGradient>

                {/* Inner shadow filter for the bar to give it an inset look at the edges */}
                <filter id={`inner-shadow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.2" />
                </filter>
            </defs>

            {/* Main colored pill with 3D gradient */}
            <rect
                x={x}
                y={actualY}
                width={width}
                height={actualHeight}
                fill={`url(#${gradientId})`}
                rx={radius}
                ry={radius}
                style={{ filter: "drop-shadow(3px 4px 6px rgba(0,0,0,0.15))" }}
            />

            {/* 3D Sphere thumb */}
            <circle
                cx={x + radius}
                cy={y}
                r={radius * 0.8}
                fill={`url(#${sphereGradientId})`}
                style={{ filter: "drop-shadow(2px 3px 4px rgba(0,0,0,0.4))" }}
            />

            {/* Value Text with slight shadow for legibility */}
            <text
                x={x + radius}
                y={y}
                fill={fill}
                textAnchor="middle"
                alignmentBaseline="central"
                fontSize={value > 99 ? 10 : 12}
                fontWeight="800"
                className="font-sans"
                dy=".1em"
                style={{ filter: "drop-shadow(0px 1px 1px rgba(255,255,255,0.8))" }}
            >
                {props.payload?.displayValue !== undefined
                    ? props.payload.displayValue
                    : (typeof value === 'number' ? value.toLocaleString() : value)}
            </text>
        </g>
    );
};
