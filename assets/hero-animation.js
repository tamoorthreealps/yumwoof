document.addEventListener("DOMContentLoaded", () => {

    const hero = document.querySelector(".hero-banner");

    if (!hero) return;

    if (typeof gsap === "undefined") {
        console.error("GSAP is not loaded.");
        return;
    }

    if (typeof ScrollTrigger !== "undefined") {
        gsap.registerPlugin(ScrollTrigger);
    }

    let split = null;

    if (typeof SplitType !== "undefined") {
        split = new SplitType(".hero-banner__heading", {
            types: "words"
        });
    }

    const tl = gsap.timeline({
        defaults: {
            ease: "power4.out"
        }
    });

    if (document.querySelector(".hero-banner__image")) {
        tl.from(".hero-banner__image", {
            scale: 1.15,
            duration: 2.5
        });
    }

    if (split) {
        tl.from(
            split.words,
            {
                y: 120,
                opacity: 0,
                stagger: 0.08,
                duration: 1
            },
            "-=2"
        );
    } else {
        tl.from(
            ".hero-banner__heading",
            {
                y: 120,
                opacity: 0,
                duration: 1
            },
            "-=2"
        );
    }

    tl.from(
        ".hero-banner__subheading",
        {
            y: 40,
            opacity: 0,
            filter: "blur(10px)",
            duration: 0.8
        },
        "-=0.5"
    );

    tl.from(
        ".hero-banner__cta-wrap",
        {
            scale: 0.7,
            opacity: 0,
            duration: 0.8,
            ease: "elastic.out(1,0.6)"
        },
        "-=0.4"
    );

    if (typeof ScrollTrigger !== "undefined") {

        gsap.to(".hero-banner__content", {
            y: -120,
            opacity: 0,
            ease: "none",
            scrollTrigger: {
                trigger: hero,
                start: "top top",
                end: "bottom top",
                scrub: true
            }
        });

        if (document.querySelector(".hero-banner__image")) {
            gsap.to(".hero-banner__image", {
                scale: 1.2,
                ease: "none",
                scrollTrigger: {
                    trigger: hero,
                    start: "top top",
                    end: "bottom top",
                    scrub: true
                }
            });
        }

    }

    const image = document.querySelector(".hero-banner__image");

    if (image) {

        hero.addEventListener("mousemove", (e) => {

            const rect = hero.getBoundingClientRect();

            const x = (e.clientX - rect.left - rect.width / 2) / 40;
            const y = (e.clientY - rect.top - rect.height / 2) / 40;

            gsap.to(image, {
                x,
                y,
                duration: 1,
                ease: "power2.out"
            });

        });

        hero.addEventListener("mouseleave", () => {

            gsap.to(image, {
                x: 0,
                y: 0,
                duration: 1
            });

        });

    }

});