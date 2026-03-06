import React from 'react';
import { motion } from 'framer-motion';

const PageTransition = ({ children }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }} // بداية الظهور (شفاف ومسحوب لتحت شوية)
            animate={{ opacity: 1, y: 0 }}  // الحالة الطبيعية
            exit={{ opacity: 0, y: -15 }}   // حركة الخروج (بيختفي ويتسحب لفوق)
            transition={{ duration: 0.3, ease: 'easeInOut' }} // سرعة ونعومة الحركة
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;