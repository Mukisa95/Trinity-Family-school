"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface BlurTextProps {
  text: string;
  delay?: number; // delay in ms between elements
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  onAnimationComplete?: () => void;
  className?: string;
}

export default function BlurText({
  text,
  delay = 200,
  animateBy = 'words',
  direction = 'top',
  onAnimationComplete,
  className = '',
}: BlurTextProps) {
  // Split by words or letters
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  
  // Convert delay to seconds
  const staggerDelay = delay / 1000;
  
  // Y displacement
  const yOffset = direction === 'top' ? -20 : 20;

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  const itemVariants = {
    hidden: {
      filter: 'blur(10px)',
      opacity: 0,
      y: yOffset,
    },
    visible: {
      filter: 'blur(0px)',
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 12,
        stiffness: 100,
      },
    },
  };

  return (
    <motion.span
      className={`inline-block ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      onAnimationComplete={onAnimationComplete}
    >
      {elements.map((element, index) => (
        <motion.span
          key={index}
          className="inline-block"
          variants={itemVariants}
          style={{
            whiteSpace: 'pre',
            marginRight: animateBy === 'words' ? '0.25em' : '0em',
          }}
        >
          {element === ' ' && animateBy === 'letters' ? '\u00A0' : element}
        </motion.span>
      ))}
    </motion.span>
  );
}
