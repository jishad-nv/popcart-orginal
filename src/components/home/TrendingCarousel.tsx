import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Product } from '../../types';
import { TrendingCard } from '../product/TrendingCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TrendingCarouselProps {
  products: Product[];
  gradients: string[];
}

export const TrendingCarousel: React.FC<TrendingCarouselProps> = ({ products, gradients }) => {
  const cappedProducts = useMemo(() => (products || []).slice(0, 12), [products]);
  const n = cappedProducts.length;

  // 5x duplication ensures ample buffer to left & right, preventing any blank gap on any screen width
  const items = useMemo(() => {
    if (!cappedProducts || cappedProducts.length === 0) return [];
    return [...cappedProducts, ...cappedProducts, ...cappedProducts, ...cappedProducts, ...cappedProducts];
  }, [cappedProducts]);

  // Start right in the center cluster (index 2 * n)
  const [currentIndex, setCurrentIndex] = useState(n > 0 ? 2 * n : 0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (n > 0) {
      setIsTransitioning(false);
      setCurrentIndex(2 * n);
    }
  }, [n]);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Measure container and card stride
  const [stride, setStride] = useState(232);
  const [cardWidth, setCardWidth] = useState(208);
  const [containerWidth, setContainerWidth] = useState(1200);

  // References
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInteractingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const isHorizontalScrollRef = useRef<boolean | null>(null);

  const startXRef = useRef(0);
  const startYRef = useRef(0);

  // Update stride and container width dynamically from DOM
  const updateMetrics = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }
    if (trackRef.current && trackRef.current.children.length >= 2) {
      const first = trackRef.current.children[0] as HTMLElement;
      const second = trackRef.current.children[1] as HTMLElement;
      const firstRect = first.getBoundingClientRect();
      const secondRect = second.getBoundingClientRect();
      const diff = secondRect.left - firstRect.left;
      if (diff > 50) {
        setStride(diff);
      }
      if (firstRect.width > 50) {
        setCardWidth(firstRect.width);
      }
    }
  }, []);

  useEffect(() => {
    updateMetrics();
    const t = setTimeout(updateMetrics, 100);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(updateMetrics);
      ro.observe(containerRef.current);
    }
    window.addEventListener('resize', updateMetrics);

    return () => {
      clearTimeout(t);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateMetrics);
    };
  }, [updateMetrics, items]);

  // Reset boundary without animation to keep infinite loop
  const handleTransitionEnd = useCallback(() => {
    setIsTransitioning(false);
    setCurrentIndex((curr) => {
      if (curr >= 3 * n) {
        return curr - n;
      }
      if (curr < n) {
        return curr + n;
      }
      return curr;
    });
  }, [n]);

  // Fallback safety timer: if browser drops transitionend event, guarantee reset within 700ms
  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        handleTransitionEnd();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning, handleTransitionEnd]);

  // Navigation controls
  const nextSlide = useCallback(() => {
    if (n === 0) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => prev + 1);
  }, [n]);

  const prevSlide = useCallback(() => {
    if (n === 0) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => prev - 1);
  }, [n]);

  // Auto-play cycle
  const startAutoPlay = useCallback(() => {
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      if (!isInteractingRef.current) {
        setIsTransitioning(true);
        setCurrentIndex((prev) => prev + 1);
      }
    }, 2800);
  }, []);

  const pauseAutoPlay = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isInteractingRef.current = false;
      startAutoPlay();
    }, 2400);
  }, [startAutoPlay]);

  useEffect(() => {
    startAutoPlay();
    return () => {
      pauseAutoPlay();
    };
  }, [startAutoPlay, pauseAutoPlay]);

  // Touch Handlers with Zero Vertical Blocking
  const handleTouchStart = (e: React.TouchEvent) => {
    pauseAutoPlay();
    isInteractingRef.current = true;
    hasDraggedRef.current = false;
    isHorizontalScrollRef.current = null;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    setIsTransitioning(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isInteractingRef.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;

    // Detect gesture angle on first 6px movement
    if (isHorizontalScrollRef.current === null) {
      if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
        isHorizontalScrollRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    // If vertical gesture, do NOT interfere with page scrolling
    if (isHorizontalScrollRef.current === false) {
      return;
    }

    // If horizontal gesture, drag carousel
    if (isHorizontalScrollRef.current === true) {
      hasDraggedRef.current = true;
      setIsDragging(true);
      setDragOffset(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (isDragging || Math.abs(dragOffset) > 10) {
      const threshold = stride * 0.2;
      setIsTransitioning(true);
      if (dragOffset < -threshold) {
        setCurrentIndex((prev) => prev + 1);
      } else if (dragOffset > threshold) {
        setCurrentIndex((prev) => prev - 1);
      }
    }
    setDragOffset(0);
    setIsDragging(false);
    isHorizontalScrollRef.current = null;
    scheduleResume();
  };

  // Mouse Handlers for Desktop Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    pauseAutoPlay();
    isInteractingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.clientX;
    setIsTransitioning(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isInteractingRef.current) return;
    const diffX = e.clientX - startXRef.current;
    if (Math.abs(diffX) > 5) {
      hasDraggedRef.current = true;
      setIsDragging(true);
      setDragOffset(diffX);
    }
  };

  const handleMouseUp = () => {
    if (isDragging || Math.abs(dragOffset) > 10) {
      const threshold = stride * 0.2;
      setIsTransitioning(true);
      if (dragOffset < -threshold) {
        setCurrentIndex((prev) => prev + 1);
      } else if (dragOffset > threshold) {
        setCurrentIndex((prev) => prev - 1);
      }
    }
    setDragOffset(0);
    setIsDragging(false);
    scheduleResume();
  };

  const handleMouseLeave = () => {
    if (isInteractingRef.current) {
      handleMouseUp();
    }
  };

  // Prevent link click when dragged
  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      hasDraggedRef.current = false;
    }
  };

  // Calculate center alignment offset so active card is dead-center
  const centerOffset = Math.max(0, (containerWidth - cardWidth) / 2);
  const currentTranslateX = -(currentIndex * stride) + centerOffset + dragOffset;

  if (!products || products.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="relative group/carousel overflow-hidden"
      onClickCapture={handleClickCapture}
    >
      {/* Left Navigation Chevron */}
      <button
        onClick={() => {
          pauseAutoPlay();
          prevSlide();
          scheduleResume();
        }}
        className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-xl border border-slate-200/90 flex items-center justify-center transition-all opacity-0 group-hover/carousel:opacity-100 hidden sm:flex cursor-pointer hover:scale-105 active:scale-95"
        aria-label="Previous trending products"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Moving Track Viewport with Strict Pan-Y to allow fluid vertical page scroll */}
      <div
        className="w-full overflow-hidden select-none py-1 sm:py-2 px-1 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={trackRef}
          onTransitionEnd={handleTransitionEnd}
          style={{
            transform: `translate3d(${currentTranslateX}px, 0, 0)`,
            transition: isTransitioning
              ? 'transform 550ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'none',
            willChange: 'transform',
          }}
          className="flex gap-3 sm:gap-6"
        >
          {items.map((product, idx) => (
            <div
              key={`${product.id}-${idx}`}
              className="shrink-0 transition-transform duration-200"
              style={{
                pointerEvents: isDragging ? 'none' : 'auto',
              }}
            >
              <TrendingCard
                product={product}
                gradientClass={gradients[idx % gradients.length]}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Right Navigation Chevron */}
      <button
        onClick={() => {
          pauseAutoPlay();
          nextSlide();
          scheduleResume();
        }}
        className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-xl border border-slate-200/90 flex items-center justify-center transition-all opacity-0 group-hover/carousel:opacity-100 hidden sm:flex cursor-pointer hover:scale-105 active:scale-95"
        aria-label="Next trending products"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};
