import { useEffect, useState } from "react";

import { resolveCourseMaterialAccessUrl } from "@/lib/courseAssets";

interface CourseMaterialImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
}

const CourseMaterialImage = ({ src, alt, className, loading = "lazy" }: CourseMaterialImageProps) => {
  const [resolvedSrc, setResolvedSrc] = useState("");

  useEffect(() => {
    let isActive = true;

    const resolveSrc = async () => {
      setResolvedSrc("");
      const nextSrc = await resolveCourseMaterialAccessUrl(src);
      if (!isActive) {
        return;
      }

      setResolvedSrc(nextSrc || src);
    };

    void resolveSrc();

    return () => {
      isActive = false;
    };
  }, [src]);

  if (!resolvedSrc) {
    return <div className={className} aria-hidden="true" />;
  }

  return <img src={resolvedSrc} alt={alt} className={className} loading={loading} />;
};

export default CourseMaterialImage;