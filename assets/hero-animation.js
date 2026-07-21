document.addEventListener("DOMContentLoaded", () => {

    gsap.registerPlugin(ScrollTrigger);

    /* ==========================
       HERO BANNER
    ========================== */

    const hero = document.querySelector(".hero-banner");

    if (hero) {

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
            y: 120,
            opacity: 0,
            stagger: 0.08,
            duration: 1,
            ease: "power4.out"
        }, "-=2")

        .from(".hero-banner__subheading", {
            y: 40,
            opacity: 0,
            filter: "blur(10px)",
            duration: .8
        }, "-=.6")

        .from(".hero-banner__cta-wrap", {
            scale: .7,
            opacity: 0,
            duration: .8,
            ease: "elastic.out(1,0.6)"
        }, "-=.4");

    }


    /* ==========================
       FEATURED PRODUCTS
    ========================== */

    const fp = document.querySelector(".fp");

    if (fp) {

        gsap.from(".fp__heading", {
            y: 80,
            opacity: 0,
            duration: 1,
            ease: "power4.out",
            scrollTrigger: {
                trigger: ".fp",
                start: "top 75%",
                once: true
            }
        });

        gsap.from(".fp__card", {
            y: 120,
            opacity: 0,
            duration: 1,
            stagger: 0.18,
            ease: "power4.out",
            scrollTrigger: {
                trigger: ".fp__track",
                start: "top 75%",
                once: true
            }
        });

    }

});