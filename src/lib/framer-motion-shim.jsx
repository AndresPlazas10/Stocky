/**
 * ZERO ANIMATIONS SHIM
 * Reemplazo de Framer Motion que elimina todas las animaciones
 * Los componentes motion.* se comportan como <div> normales
 * AnimatePresence renderiza children sin animación
 */

import { forwardRef } from 'react';

// Componente base sin animaciones
const createMotionComponent = (tag) => {
  return forwardRef(({
    children,
    className,
    style,
    onClick,
    onSubmit,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    variants: _variants,
    whileHover: _whileHover,
    whileTap: _whileTap,
    whileInView: _whileInView,
    whileFocus: _whileFocus,
    whileDrag: _whileDrag,
    layout: _layout,
    layoutId: _layoutId,
    drag: _drag,
    dragConstraints: _dragConstraints,
    dragElastic: _dragElastic,
    dragMomentum: _dragMomentum,
    viewport: _viewport,
    onAnimationStart: _onAnimationStart,
    onAnimationComplete: _onAnimationComplete,
    ...props
  }, ref) => {
    const Element = tag || 'div';
    return (
      <Element 
        ref={ref}
        className={className}
        style={style}
        onClick={onClick}
        onSubmit={onSubmit}
        {...props}
      >
        {children}
      </Element>
    );
  });
};

// Exportar todos los componentes motion como elementos normales
export const motion = {
  div: createMotionComponent('div'),
  span: createMotionComponent('span'),
  p: createMotionComponent('p'),
  h1: createMotionComponent('h1'),
  h2: createMotionComponent('h2'),
  h3: createMotionComponent('h3'),
  button: createMotionComponent('button'),
  form: createMotionComponent('form'),
  section: createMotionComponent('section'),
  article: createMotionComponent('article'),
  header: createMotionComponent('header'),
  footer: createMotionComponent('footer'),
  nav: createMotionComponent('nav'),
  main: createMotionComponent('main'),
  aside: createMotionComponent('aside'),
  ul: createMotionComponent('ul'),
  li: createMotionComponent('li'),
  a: createMotionComponent('a'),
  img: createMotionComponent('img'),
  input: createMotionComponent('input'),
  textarea: createMotionComponent('textarea'),
  select: createMotionComponent('select'),
  label: createMotionComponent('label'),
};

// AnimatePresence sin animación - solo renderiza children
export const AnimatePresence = ({ children, mode: _mode, initial: _initial, onExitComplete: _onExitComplete }) => {
  return <>{children}</>;
};

// Hooks dummy (por si acaso)
export const useAnimation = () => ({});
export const useMotionValue = (value) => ({ get: () => value, set: () => {} });
export const useTransform = () => ({});
export const useSpring = (value) => value;
export const useScroll = () => ({ scrollY: { get: () => 0 } });
export const useVelocity = () => ({ get: () => 0 });

// Exportación por defecto
export default { motion, AnimatePresence };
