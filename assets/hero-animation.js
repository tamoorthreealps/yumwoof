document.addEventListener("DOMContentLoaded", () => {

    gsap.registerPlugin(ScrollTrigger);

    /* ---------------- Hero ---------------- */

    if (document.querySelector(".hero-banner")) {

        const split = new SplitType(".hero-banner__heading", {
            types: "words"
        });

        const tl = gsap.timeline();

        if (document.querySelector(".hero-banner__image")) {
            tl.from(".hero-banner__image", {
                scale: 1.15,
                duration: 2.5,
                ease: "power2.out"
            });
        }

        tl.from(split.words, {
            yPercent: 100,
            opacity: 0,
            stagger: 0.08,
            duration: 1,
            ease: "power4.out"
        }, "-=2")

        .from(".hero-banner__subheading", {
            y: 30,
            opacity: 0,
            duration: .8
        }, "-=.5")

        .from(".hero-banner__cta-wrap", {
            y: 30,
            opacity: 0,
            duration: .8
        }, "-=.5");

    }

    /* ---------------- Featured Products ---------------- */

    if (document.querySelector(".fp")) {

        gsap.set(".fp__card", {
            opacity: 0,
            y: 100
        });

        ScrollTrigger.create({

            trigger: ".fp",

            start: "top 75%",

            once: true,

            onEnter: () => {

                gsap.to(".fp__card", {

                    opacity: 1,

                    y: 0,

                    duration: 1,

                    stagger: .18,

                    ease: "power3.out",

                    clearProps: "transform"

                });

            }

        });

    }

});