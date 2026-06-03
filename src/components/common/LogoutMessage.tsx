"use client";

import { motion } from 'framer-motion';
import { SignOut, Heart } from '@phosphor-icons/react';

interface LogoutMessageProps {
  username: string;
}

const LogoutMessage = ({ username }: LogoutMessageProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 20 }}
        className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-4 text-center"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <SignOut size={32} className="text-blue-600" weight="duotone" />
        </motion.div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Goodbye, {username}!
        </h2>
        
        <p className="text-gray-600 mb-4">
          Thank you for using our school management system.
        </p>
        
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="flex items-center justify-center gap-2 text-red-500"
        >
          <Heart size={20} weight="fill" />
          <span className="text-sm">Have a great day!</span>
          <Heart size={20} weight="fill" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default LogoutMessage; 