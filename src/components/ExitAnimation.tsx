import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// import { useStore } from '../../../utils/store';

const ExitAnimation = ({ children }: { children: ReactNode }) => {
  // const { exitThree } = useStore();
  return (
    <AnimatePresence>
      {!exitThree && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1 } }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
export default ExitAnimation;
