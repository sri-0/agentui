"use client";

import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { artifactUrl, useRecentArtifacts } from "@/lib/api/artifacts";
import AutoScroll from "embla-carousel-auto-scroll";
import Link from "next/link";
import { useState } from "react";

/** How many of the latest images the carousel shows. */
const RECENT = 12;

/** The latest images, scrolling past until hovered; each opens its
 *  conversation. Nothing until there is one. */
export function RecentImages() {
  const { data } = useRecentArtifacts("image");
  const [plugins] = useState(() => [AutoScroll({ speed: 0.6, stopOnInteraction: false, stopOnMouseEnter: true })]);
  const images = data?.pages[0]?.data.slice(0, RECENT) ?? [];
  if (images.length === 0) return null;
  return (
    <section aria-label="Recent images" className="mt-12 w-full">
      <h2 className="mb-3 text-xs font-medium text-muted-foreground">Recent images</h2>
      <Carousel
        opts={{ loop: true, dragFree: true, align: "start" }}
        plugins={plugins}
        className="[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
      >
        <CarouselContent>
          {images.map((a) => (
            <CarouselItem key={`${a.root_id}/${a.id}`} className="basis-1/3 sm:basis-1/4">
              <Link href={`/chat/${a.root_id}`} title={a.title} className="block overflow-hidden rounded-xl border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, any size */}
                <img
                  src={artifactUrl(a.root_id, a)}
                  alt={a.title}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}
