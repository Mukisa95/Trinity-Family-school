import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface QuickActionButtonProps extends Omit<HTMLMotionProps<"div">, "onClick"> {
    title: string;
    icon: LucideIcon;
    baseColor: string;
    darkColor: string;
    onClick?: () => void;
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({
    title,
    icon: Icon,
    baseColor,
    darkColor,
    onClick,
    className = "",
    ...props
}) => {
    return (
        <motion.div
            onClick={onClick}
            className={`relative h-14 w-full cursor-pointer flex items-center group ${className}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            {...props}
        >
            {/* 
        The Ribbon Structure:
        1. Circle block on the left (darker color containing the icon).
        2. Ribbon trail on the right (lighter color containing text, angled cut on the right).
      */}

            {/* Ribbon Trail (Background) */}
            <div
                className="absolute left-6 top-1.5 bottom-1.5 right-0 flex items-center pl-10 pr-4"
                style={{
                    backgroundColor: baseColor,
                    // CSS Polygon creates the angled cut on the right side
                    clipPath: 'polygon(0 0, 100% 0, 92% 100%, 0 100%)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
            >
                <span className="text-white font-bold tracking-wide uppercase text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                    {title}
                </span>
            </div>

            {/* Decorative inner shadow/fold effect on the ribbon */}
            <div
                className="absolute left-[3.25rem] top-1.5 bottom-1.5 w-4 opacity-20 pointer-events-none"
                style={{
                    background: `linear-gradient(to right, #000 0%, transparent 100%)`,
                }}
            />

            {/* Left Icon Block (Circle embedded into a square-ish base) */}
            <div className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center pointer-events-none">
                {/* Outer Dark Circle/Border */}
                <div
                    className="w-14 h-14 rounded-full flex items-center justify-center relative z-10"
                    style={{
                        backgroundColor: darkColor,
                        border: `3px solid ${baseColor}`, // Matches image inner outline style
                        boxShadow: '2px 2px 5px rgba(0,0,0,0.3)',
                    }}
                >
                    {/* Inner Light Ring */}
                    <div className="w-10 h-10 rounded-full border border-white/40 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-white drop-shadow-md" />
                    </div>
                </div>
            </div>

        </motion.div>
    );
};
