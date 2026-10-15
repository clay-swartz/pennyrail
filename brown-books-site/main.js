
const LOGO = "https://images.squarespace-cdn.com/content/v1/6715292b3e22816ea9d82490/f5fced9f-26f1-4749-bb36-e64fa2b47f88/BB%2BFULL%2BLOGO%2BRED.png";

const NAV = [
  ["About","/about/"],
  ["Authors","/authors/"],
  ["Publicity","/publicity/"],
  ["News","/news/"],
  ["Shop","/shop/"],
  ["Submissions","/submissions/"]
];

const books = [
  {
    title: "Mission Possible",
    subtitle: "Finding Humor and Strength While Caring for Loved Ones with Dementia",
    price: "$24.95",
    image: "https://images.squarespace-cdn.com/content/v1/6715292b3e22816ea9d82490/02ed95e0-bfe5-4c45-8528-9b0666f5c56f/Mission%2BPossible.png"
  },
  {
    title: "Sounds of America",
    subtitle: "A new release from Brown Books Kids",
    price: "$17.99",
    image: "https://images.squarespace-cdn.com/content/v1/6715292b3e22816ea9d82490/eb528240-415d-4d3f-a9fa-c1bb36304581/Sounds%2Bof%2BAmerica.png"
  },
  {
    title: "I'm Right Here",
    subtitle: "A story of a mother's love across the universe",
    price: "$17.99",
    image: "https://images.squarespace-cdn.com/content/v1/6715292b3e22816ea9d82490/0ca8d07f-dbe4-4c77-91ab-bd0232c83597/I%27m%2BRight%2BHere.png"
  },
  {
    title: "Bartholomew's Miraculous Journey",
    subtitle: "A heartwarming tale of faith, patience, and purpose",
    price: "$16.99",
    image: "https://images.squarespace-cdn.com/content/v1/6715292b3e22816ea9d82490/ec4c36d1-7bb0-42e7-aaa5-a946544b3883/Bartholomew%27s%2BMiraculous%2BJourney.png"
  }
];

const process = [
  ["Build it together.","Editorial, design, and production work as one publishing team around the book—not as disconnected vendors.","ONE HOUSE","Editorial · Design · Production"],
  ["Keep what’s yours.","Authors retain the rights to their work and participate in the creative process from manuscript through market.","80–90%","of profits from book sales"],
  ["Take it to market.","Distribution, a national sales force, marketing, publicity, and rights support extend the work far beyond publication day.","GLOBAL","wholesale · retail · libraries"]
];

const bookTypes = [
  ["Business","Ideas, expertise, leadership and books built to support a bigger professional platform."],
  ["Coffee table","Highly visual books where concept, photography, design and production quality carry equal weight."],
  ["Memoir","Personal stories shaped with editorial rigor, voice, structure and a clear reason to exist."],
  ["History","Deeply researched books that make people, places and moments worth returning to."],
  ["Art","Visually driven projects for artists, collectors, institutions and creative communities."],
  ["Political","Argument, analysis, leadership and current-affairs books made for serious public conversation."],
  ["Children’s","Picture books, board books, early readers, chapter books and young adult projects."]
];

const authors = [
  ["Maria Bellia Abbate","https://www.brownbooks.com/maria-bellia-abbate"],
  ["Alexandra Allred","https://www.brownbooks.com/alexandra-allred"],
  ["Robbie Bach","https://www.brownbooks.com/robbie-bach"],
  ["Alex Becker","https://www.brownbooks.com/alex-becker"],
  ["Christy Bowe","https://www.brownbooks.com/christy-bowe"],
  ["Melissa Corley Carter","https://www.brownbooks.com/melissa-corley-carter"],
  ["Esther Clark","https://www.brownbooks.com/esther-clark"],
  ["Steve Copling","https://www.brownbooks.com/steve-copling"],
  ["Jeff Crilley","https://www.brownbooks.com/jeff-crilley"],
  ["Matthew Crosston","https://www.brownbooks.com/matthew-crosston"],
  ["Stratton Horres","https://www.brownbooks.com/stratton-horres"],
  ["Julie Lucht","https://www.brownbooks.com/julie-lucht"]
];

const imprints = [
  ["Brown Books Publishing Group","Fiction, nonfiction, business, biography, leadership, history and lifestyle."],
  ["Brown Books Kids","Picture books, board books, early readers, chapter books and young adult books."],
  ["Michael Sampson Books","Storytelling focused on cultivating the joy of reading in children."],
  ["The Small Press","Top-level publishing services for smaller print runs and personal projects."],
  ["RADO’s Press","A nonprofit children’s press supporting rescue animals through Operation Kindness."],
  ["Brown Christian Press","Books intended to inspire, enrich and serve Christian readers."]
];

const mediaNames = ["CNN","Bloomberg","TODAY","Good Morning America","Forbes","USA Today","The Washington Post"];

function navMarkup(){
  const current = document.body.dataset.page;
  return NAV.map(([label,href]) => {
    const key = label.toLowerCase();
    return `<a class="${current===key?'active':''}" href="${href}">${label}</a>`;
  }).join("");
}

class SiteHeader extends HTMLElement {
  connectedCallback(){
    this.innerHTML = `
      <header class="site-header">
        <div class="utility-bar">
          <div class="shell utility-inner">
            <div class="utility-meta">
              <span>Dallas, Texas</span>
              <span class="utility-sep">/</span>
              <span>Relationship Publishing® since 1994</span>
            </div>
            <div class="utility-contact">
              <a href="tel:+19723810009">(972) 381-0009</a>
              <span class="utility-dot" aria-hidden="true"></span>
              <a href="mailto:publishing@brownbooks.com">publishing@brownbooks.com</a>
            </div>
          </div>
        </div>
        <div class="shell header-inner">
          <a class="brand" href="/" aria-label="Brown Books Publishing Group home">
            <img src="${LOGO}" alt="Brown Books Publishing Group" />
          </a>
          <nav class="nav" aria-label="Primary">${navMarkup()}</nav>
          <a class="header-cta" href="/submissions/">Want to talk?</a>
        </div>
      </header>`;
  }
}
customElements.define("site-header", SiteHeader);

class LeadForm extends HTMLElement {
  connectedCallback(){
    const mode = this.getAttribute("mode") || "publishing";
    const publicity = mode === "publicity";
    this.innerHTML = `
      <form class="lead-card">
        <p class="card-kicker">${publicity ? "Publicity + marketing" : "Start here"}</p>
        <h2>${publicity ? "Where should your book go next?" : "Let’s talk about your book."}</h2>
        <p>${publicity ? "Tell us about the book and the audience you want to reach." : "Every great publishing partnership starts with a conversation."}</p>
        <div class="field-grid">
          <label><span>Name</span><input required name="name" autocomplete="name" /></label>
          <label><span>Email</span><input required type="email" name="email" autocomplete="email" /></label>
          ${publicity ? `
          <label><span>Book title / topic</span><input required name="book" /></label>
          <label><span>Primary goal</span>
            <select name="goal">
              <option>Media coverage</option>
              <option>Launch strategy</option>
              <option>Author platform</option>
              <option>Paid marketing</option>
              <option>Retail visibility</option>
              <option>Not sure yet</option>
            </select>
          </label>` : ""}
        </div>

        <div class="upload-field">
          <span class="upload-label">${publicity ? "Book / media materials" : "Manuscript or proposal"}</span>
          <label class="upload-control">
            <input
              class="upload-input"
              type="file"
              name="manuscript"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            />
            <span class="upload-icon" aria-hidden="true">↥</span>
            <span class="upload-copy">
              <strong>Attach a file</strong>
              <small>PDF, DOC, or DOCX · up to 25 MB</small>
            </span>
            <span class="upload-name">No file selected</span>
          </label>
        </div>

        <button type="submit">${publicity ? "Talk publicity" : "Start a conversation"}</button>
        <div class="form-status" role="status" aria-live="polite"></div>
        <small>${publicity ? 'Or email <a href="mailto:publicity@brownbooks.com">publicity@brownbooks.com</a>' : 'Prefer the phone? <a href="tel:+19723810009">(972) 381-0009</a>'}</small>
      </form>`;

    const form = this.querySelector("form");
    const status = this.querySelector(".form-status");
    const button = this.querySelector("button");
    const uploadInput = this.querySelector(".upload-input");
    const uploadName = this.querySelector(".upload-name");

    uploadInput.addEventListener("change", () => {
      const file = uploadInput.files?.[0];
      if(!file){
        uploadName.textContent = "No file selected";
        uploadName.classList.remove("has-file");
        return;
      }

      const allowedExtensions = /\.(pdf|doc|docx)$/i;
      if(!allowedExtensions.test(file.name)){
        uploadInput.value = "";
        uploadName.textContent = "Choose a PDF, DOC, or DOCX";
        uploadName.classList.remove("has-file");
        return;
      }

      if(file.size > 25 * 1024 * 1024){
        uploadInput.value = "";
        uploadName.textContent = "File must be under 25 MB";
        uploadName.classList.remove("has-file");
        return;
      }

      uploadName.textContent = file.name;
      uploadName.classList.add("has-file");
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if(!form.checkValidity()){ form.reportValidity(); return; }
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "Thanks — got it";
      status.textContent = uploadInput.files?.[0]
        ? "Concept form only — the selected file was not uploaded."
        : "Concept form only — no information was sent.";
      setTimeout(() => { button.disabled = false; button.textContent = original; }, 1800);
    });
  }
}
customElements.define("lead-form", LeadForm);

class HomeHero extends HTMLElement {
  connectedCallback(){
    this.innerHTML = `
      <section class="hero home-hero">
        <div class="hero-pattern" aria-hidden="true"></div>
        <div class="shell hero-grid">
          <div class="hero-copy">
            <p class="eyebrow light">Relationship Publishing® since 1994</p>
            <h1>More than a publisher.<br><em>An author’s advantage.</em></h1>
            <p class="hero-lede">Brown Books gives authors the quality, reach, and expertise of a professional publishing house—without asking them to give up ownership of the work they created.</p>
            <div class="hero-proof"><span>Rights retained</span><span>80–90% of profits</span><span>Sales + distribution</span></div>
          </div>
          <lead-form></lead-form>
        </div>
      </section>`;
  }
}
customElements.define("home-hero", HomeHero);

class RelationshipProcess extends HTMLElement {
  connectedCallback(){
    this.innerHTML = `
      <section class="process-section">
        <div class="shell">
          <div class="section-head process-head">
            <div><p class="eyebrow">The Brown Books model</p><h2>A publishing relationship built around the author.</h2></div>
            <p>Brown Books pioneered Relationship Publishing® to combine professional publishing quality with author ownership, stronger economics, and full-market support.</p>
          </div>
          <div class="process-layout">
            <div class="process-steps" role="list">
              ${process.map((step,index)=>`
                <button class="process-step ${index===0?'active':''}" type="button" data-index="${index}" aria-pressed="${index===0?'true':'false'}">
                  <span class="step-number">0${index+1}</span>
                  <span class="step-copy"><strong>${step[0]}</strong><span>${step[1]}</span></span>
                </button>`).join("")}
            </div>
            <div class="process-media" aria-live="polite">
              <div class="process-media-inner"><span class="process-stat">${process[0][2]}</span><span class="process-detail">${process[0][3]}</span></div>
            </div>
          </div>
        </div>
      </section>`;

    const buttons = [...this.querySelectorAll(".process-step")];
    const stat = this.querySelector(".process-stat");
    const detail = this.querySelector(".process-detail");
    const activate = (i) => {
      buttons.forEach((b,index)=>{
        const active = index===i;
        b.classList.toggle("active",active);
        b.setAttribute("aria-pressed",String(active));
      });
      stat.textContent = process[i][2];
      detail.textContent = process[i][3];
    };
    buttons.forEach((button,i)=>{
      button.addEventListener("click",()=>activate(i));
      button.addEventListener("mouseenter",()=>activate(i));
      button.addEventListener("focus",()=>activate(i));
    });
  }
}
customElements.define("relationship-process", RelationshipProcess);

class ServiceTicker extends HTMLElement {
  connectedCallback(){
    const items = ["Editorial","Book design","Production","Distribution","Sales","Licensing","Public relations","Marketing","Social media","Fulfillment"];
    const set=(hidden=false)=>`<div class="ticker-set" ${hidden?'aria-hidden="true"':'role="list"'}>${items.map(item=>`<span class="ticker-item" ${hidden?'':'role="listitem"'}><i></i>${item}</span>`).join("")}</div>`;
    this.innerHTML=`<section class="ticker-wrap"><div class="ticker-viewport" tabindex="0"><div class="ticker-track">${set(false)}${set(true)}</div></div></section>`;
  }
}
customElements.define("service-ticker", ServiceTicker);

class BooksStrip extends HTMLElement {
  connectedCallback(){
    this.innerHTML = `
      <section class="books-section">
        <div class="shell">
          <div class="section-head compact">
            <div><p class="eyebrow">On the shelf now</p><h2>Fresh from Brown Books.</h2></div>
            <a class="text-link" href="/shop/">Shop new releases →</a>
          </div>
          <div class="book-row">
            ${books.map(book=>`
              <article class="book">
                <div class="book-art"><img src="${book.image}" alt="Cover of ${book.title}" /></div>
                <div class="book-meta"><h3>${book.title}</h3><p>${book.subtitle}</p><span>${book.price}</span></div>
              </article>`).join("")}
          </div>
        </div>
      </section>`;
  }
}
customElements.define("books-strip", BooksStrip);

class BookTypes extends HTMLElement {
  connectedCallback(){
    this.innerHTML = `
      <section class="types-section">
        <div class="shell">
          <div class="section-head compact">
            <div><p class="eyebrow">What we publish</p><h2>Different books. One standard.</h2></div>
          </div>
          <div class="types-grid">
            ${bookTypes.map((type,index)=>`
              <article class="type"><span>0${index+1}</span><h3>${type[0]}</h3><p>${type[1]}</p></article>`).join("")}
          </div>
        </div>
      </section>`;
  }
}
customElements.define("book-types", BookTypes);

class FaqAccordion extends HTMLElement {
  connectedCallback(){
    const faqs = [
      ["What is hybrid publishing?","A model that combines professional publishing support with author investment, faster timelines, and greater creative and financial control than most traditional routes."],
      ["Do Brown Books authors keep their rights?","Yes. Brown Books says its authors retain the rights to their work and remain part of the creative process."],
      ["What does distribution include?","Brown Books supports wholesale and retail distribution with a sales force that presents titles to book buyers and helps keep books available in the market beyond launch."],
      ["What does an editor bring to a book?","Professional editing strengthens structure, clarity, consistency, readability, and the way an author’s message reaches the reader."]
    ];
    this.innerHTML = `
      <section class="faq-section">
        <div class="shell faq-layout">
          <div class="faq-intro"><p class="eyebrow">Questions authors ask</p><h2>Know the model before you choose the publisher.</h2><a class="text-link" href="/about/">More about the model →</a></div>
          <div class="faq-list">
            ${faqs.map((faq,index)=>`<details ${index===0?'open':''}><summary><span>${faq[0]}</span><b aria-hidden="true">+</b></summary><p>${faq[1]}</p></details>`).join("")}
          </div>
        </div>
      </section>`;
  }
}
customElements.define("faq-accordion", FaqAccordion);

class InteriorHero extends HTMLElement {
  connectedCallback(){
    const eyebrow=this.getAttribute("eyebrow")||"Brown Books";
    const title=this.getAttribute("title")||"";
    const copy=this.getAttribute("copy")||"";
    this.innerHTML=`<section class="interior-hero"><div class="shell interior-hero-inner"><p class="eyebrow light">${eyebrow}</p><h1>${title}</h1><p>${copy}</p></div></section>`;
  }
}
customElements.define("interior-hero", InteriorHero);

class PublicityPage extends HTMLElement {
  connectedCallback(){
    const services = [
      ["Public relations","Media strategy, trade outreach, interviews, reviews and earned coverage."],
      ["Marketing + advertising","Campaigns timed to support visibility, launches and moments that matter."],
      ["Social media","A practical social strategy that supports the book without making content creation the whole job."],
      ["Author platform","Messaging, positioning and assets that help the author show up consistently."],
      ["Endorsements","Credibility-building outreach to recognizable voices and relevant experts."],
      ["Events + moments","Launches, appearances and opportunities designed to extend the campaign."]
    ];
    this.innerHTML=`
      <section class="publicity-hero">
        <div class="hero-pattern" aria-hidden="true"></div>
        <div class="shell hero-grid publicity-grid">
          <div class="hero-copy">
            <p class="eyebrow light">Publicity · marketing · PR</p>
            <h1>Publish the book.<br><em>Then put it to work.</em></h1>
            <p class="hero-lede">Brown Books helps get you—and your book—into the marketplace with a coordinated strategy across publicity, marketing, media, social, and retail visibility.</p>
          </div>
          <lead-form mode="publicity"></lead-form>
        </div>
      </section>
      <section class="market-section">
        <div class="shell">
          <div class="section-head"><div><p class="eyebrow">From launch to long tail</p><h2>Make the book part of a bigger conversation.</h2></div><p>Brown Books’ publicity team sits inside the publishing ecosystem, so the campaign can work with editorial, branding, distribution and sales instead of arriving after the fact.</p></div>
          <div class="service-grid">${services.map((s,i)=>`<article><span>0${i+1}</span><h3>${s[0]}</h3><p>${s[1]}</p></article>`).join("")}</div>
        </div>
      </section>
      <section class="media-proof"><div class="shell"><p>Brown Books authors have appeared in</p><div class="media-names">${mediaNames.map(n=>`<span>${n}</span>`).join("")}</div></div></section>
      <section class="cta-band"><div class="shell cta-inner"><div><p class="eyebrow light">Ready to build the campaign?</p><h2>Get the book out there.</h2></div><a class="button light-button" href="#top" onclick="window.scrollTo({top:0,behavior:'smooth'});return false;">Talk publicity</a></div></section>`;
  }
}
customElements.define("publicity-page", PublicityPage);

class AboutPage extends HTMLElement {
  connectedCallback(){
    this.innerHTML=`
      <interior-hero eyebrow="The Brown Books story" title="A different way to publish." copy="Founded in 1994, Brown Books built an author-first model around ownership, professional publishing quality, and long-term market support."></interior-hero>
      <section class="story-section"><div class="shell split-copy"><div><p class="eyebrow">Relationship Publishing®</p><h2>Professional publishing without surrendering the book.</h2></div><div><p>Brown Books pioneered a model that gives authors greater ownership, involvement, and profitability while keeping editorial, design, production, distribution, sales, marketing and publicity under one roof.</p><p>That means the book is developed as a publishing product and supported as a business, platform, legacy project, or creative work—depending on what the author needs it to do.</p></div></div></section>
      <relationship-process></relationship-process>
      <section class="imprints-section"><div class="shell"><div class="section-head compact"><div><p class="eyebrow">Imprints</p><h2>One publishing family. Distinct missions.</h2></div></div><div class="imprints-grid">${imprints.map((item,i)=>`<article><span>0${i+1}</span><h3>${item[0]}</h3><p>${item[1]}</p></article>`).join("")}</div></div></section>
      <section class="cta-band"><div class="shell cta-inner"><div><p class="eyebrow light">Your book, your rights</p><h2>See if the model fits.</h2></div><a class="button light-button" href="/submissions/">Start a conversation</a></div></section>`;
  }
}
customElements.define("about-page", AboutPage);

class AuthorsPage extends HTMLElement {
  connectedCallback(){
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    this.innerHTML=`
      <interior-hero eyebrow="Our authors" title="The people behind the books." copy="From New York Times bestsellers to first-time authors, Brown Books has built its list around people with something worth saying—and a reason to put it into print."></interior-hero>
      <section class="authors-section"><div class="shell">
        <div class="alphabet" aria-label="Author index">${letters.map(l=>`<span>${l}</span>`).join("")}</div>
        <div class="author-grid">${authors.map((a,i)=>`<a class="author-card" href="${a[1]}" target="_blank" rel="noreferrer"><span>${String(i+1).padStart(2,"0")}</span><h3>${a[0]}</h3><b aria-hidden="true">↗</b></a>`).join("")}</div>
        <div class="page-link-row"><a class="text-link" href="https://www.brownbooks.com/authors-page" target="_blank" rel="noreferrer">Browse the complete current author directory ↗</a></div>
      </div></section>`;
  }
}
customElements.define("authors-page", AuthorsPage);

class ShopPage extends HTMLElement {
  connectedCallback(){
    this.innerHTML=`
      <interior-hero eyebrow="Brown Books shop" title="Books made to earn their place on the shelf." copy="Browse new releases, award winners, fiction, nonfiction and children’s books from across the Brown Books publishing family."></interior-hero>
      <section class="shop-section"><div class="shell">
        <div class="category-row"><button class="active">All</button><button>New releases</button><button>Award winning</button><button>Fiction</button><button>Nonfiction</button><button>Children’s</button></div>
        <books-strip></books-strip>
        <div class="page-link-row"><a class="button" href="https://www.brownbooks.com/shop" target="_blank" rel="noreferrer">Shop the live catalog ↗</a></div>
      </div></section>`;
  }
}
customElements.define("shop-page", ShopPage);

class NewsPage extends HTMLElement {
  connectedCallback(){
    const posts = [
      ["March 6, 2026","The Birth of a Genre","A look at how literary genres came to be, how they’ve changed over time, and why writers keep remixing them."],
      ["March 6, 2026","So You're Going to a Library Conference","What authors should know about networking, pitching and creating lasting opportunities."],
      ["February 4, 2026","Rescue Animals Deserve Our Support","An introduction to RADO’s Press, Brown Books’ nonprofit children’s imprint."]
    ];
    const events = [
      ["November 7, 2026","Book Signing with Author Alexandra Allred"],
      ["November 7, 2026","Book Signing with Author Julie Lucht"],
      ["October 20, 2026","Book Launch with Author Stratton Horres"]
    ];
    this.innerHTML=`
      <interior-hero eyebrow="News + events" title="Brown Books, in motion." copy="Publishing news, author stories, events, media moments and ideas from inside the house."></interior-hero>
      <section class="news-section"><div class="shell news-layout">
        <div><p class="eyebrow">News</p><div class="story-list">${posts.map(p=>`<article><span>${p[0]}</span><h3>${p[1]}</h3><p>${p[2]}</p></article>`).join("")}</div></div>
        <aside><p class="eyebrow">Upcoming</p><div class="event-list">${events.map(e=>`<article><span>${e[0]}</span><h3>${e[1]}</h3></article>`).join("")}</div></aside>
      </div></section>
      <section class="cta-band"><div class="shell cta-inner"><div><p class="eyebrow light">Brown Books Express</p><h2>More from inside publishing.</h2></div><a class="button light-button" href="https://brownbooksexpress.substack.com/" target="_blank" rel="noreferrer">Read the newsletter ↗</a></div></section>`;
  }
}
customElements.define("news-page", NewsPage);

class SubmissionsPage extends HTMLElement {
  connectedCallback(){
    this.innerHTML=`
      <section class="connect-hero submissions-hero">
        <div class="hero-pattern" aria-hidden="true"></div>
        <div class="shell hero-grid">
          <div class="hero-copy">
            <p class="eyebrow light">Submissions</p>
            <h1>Have a book?<br><em>Show us.</em></h1>
            <p class="hero-lede">Tell us what you’re working on and attach a manuscript or proposal. We’ll help you figure out whether Brown Books is the right publishing fit.</p>
          </div>
          <lead-form></lead-form>
        </div>
      </section>
      <section class="contact-section">
        <div class="shell contact-grid">
          <div><p class="eyebrow">Call</p><h3>(972) 381-0009</h3></div>
          <div><p class="eyebrow">Email</p><h3>publishing@brownbooks.com</h3></div>
          <div><p class="eyebrow">Visit</p><h3>16250 Knoll Trail Drive, Suite 205<br>Dallas, Texas 75248</h3></div>
        </div>
      </section>`;
  }
}
customElements.define("submissions-page", SubmissionsPage);

class CtaBand extends HTMLElement {
  connectedCallback(){
    this.innerHTML=`<section class="cta-band"><div class="shell cta-inner"><div><p class="eyebrow light">Your book starts with a conversation</p><h2>Bring the idea.<br>Build the book together.</h2></div><div class="cta-actions"><a class="button light-button" href="/submissions/">Talk about your book</a><a class="cta-phone" href="tel:+19723810009">(972) 381-0009</a></div></div></section>`;
  }
}
customElements.define("cta-band", CtaBand);

class SiteFooter extends HTMLElement {
  connectedCallback(){
    this.innerHTML=`
      <footer class="site-footer">
        <div class="shell footer-grid">
          <div class="footer-brand"><img src="${LOGO}" alt="Brown Books Publishing Group" /><p>Dallas, Texas · Independent publishing since 1994.</p></div>
          <div><strong>Contact</strong><a href="mailto:publishing@brownbooks.com">publishing@brownbooks.com</a><a href="tel:+19723810009">(972) 381-0009</a></div>
          <div><strong>Visit</strong><span>16250 Knoll Trail Drive, Suite 205</span><span>Dallas, Texas 75248</span></div>
          <div><strong>Explore</strong><a href="/about/">About</a><a href="/publicity/">Publicity</a><a href="/authors/">Authors</a><a href="/shop/">Shop</a></div>
        </div>
        <div class="shell concept-note">Redesign concept for review · Not the current Brown Books website.</div>
      </footer>`;
  }
}
customElements.define("site-footer", SiteFooter);

class HomePage extends HTMLElement {
  connectedCallback(){
    this.innerHTML=`<home-hero></home-hero><relationship-process></relationship-process><service-ticker></service-ticker><books-strip></books-strip><book-types></book-types><faq-accordion></faq-accordion><cta-band></cta-band>`;
  }
}
customElements.define("home-page", HomePage);

class BrownBooksSite extends HTMLElement {
  connectedCallback(){
    const page = document.body.dataset.page || "home";
    const tag = {
      home:"home-page",
      about:"about-page",
      authors:"authors-page",
      publicity:"publicity-page",
      news:"news-page",
      shop:"shop-page",
      submissions:"submissions-page"
    }[page] || "home-page";
    this.innerHTML=`<site-header></site-header><main><${tag}></${tag}></main><site-footer></site-footer>`;
  }
}
customElements.define("bb-site", BrownBooksSite);
