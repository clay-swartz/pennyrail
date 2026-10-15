const LOGO = "https://images.squarespace-cdn.com/content/6715292b3e22816ea9d82490/e7eaf517-4139-426c-820b-1ae464f2bd0e/Logo_BBPG.png?content-type=image%2Fpng";

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
  {
    title: "Build it together.",
    body: "Editorial, design, and production work as one publishing team around the book—not as disconnected vendors.",
    stat: "ONE HOUSE",
    detail: "Editorial · Design · Production"
  },
  {
    title: "Keep what’s yours.",
    body: "Authors retain the rights to their work and participate in the creative process from manuscript through market.",
    stat: "80–90%",
    detail: "of profits from book sales"
  },
  {
    title: "Take it to market.",
    body: "Distribution, a national sales force, marketing, publicity, and rights support extend the work far beyond publication day.",
    stat: "GLOBAL",
    detail: "wholesale · retail · libraries"
  }
];

class SiteHeader extends HTMLElement {
  connectedCallback(){
    this.innerHTML = \`
      <header class="site-header">
        <div class="shell header-inner">
          <a class="brand" href="#top" aria-label="Brown Books Publishing Group home">
            <img src="\${LOGO}" alt="Brown Books Publishing Group" />
          </a>
          <nav class="nav" aria-label="Primary">
            <a href="#model">Our model</a>
            <a href="#books">Books</a>
            <a href="#services">Services</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a class="header-cta" href="#contact">Talk about your book</a>
        </div>
      </header>\`;
  }
}
customElements.define('site-header', SiteHeader);

class HeroLead extends HTMLElement {
  connectedCallback(){
    this.innerHTML = \`
      <section class="hero" id="top">
        <div class="hero-pattern" aria-hidden="true"></div>
        <div class="shell hero-grid">
          <div class="hero-copy">
            <p class="eyebrow light">Relationship Publishing® since 1994</p>
            <h1>More than a publisher.<br><em>An author’s advantage.</em></h1>
            <p class="hero-lede">Brown Books gives authors the quality, reach, and expertise of a professional publishing house—without asking them to give up ownership of the work they created.</p>
            <div class="hero-proof" aria-label="Brown Books advantages">
              <span>Rights retained</span>
              <span>80–90% of profits</span>
              <span>Sales + distribution</span>
            </div>
          </div>
          <form class="lead-card" id="contact">
            <p class="card-kicker">Start here</p>
            <h2>Let’s talk about your book.</h2>
            <p>Every great publishing partnership starts with a conversation.</p>
            <div class="field-grid">
              <label><span>Name</span><input required name="name" autocomplete="name" /></label>
              <label><span>Email</span><input required type="email" name="email" autocomplete="email" /></label>
            </div>
            <button type="submit">Start a conversation</button>
            <div class="form-status" role="status" aria-live="polite"></div>
            <small>Prefer the phone? <a href="tel:+19723810009">(972) 381-0009</a></small>
          </form>
        </div>
      </section>\`;

    const form = this.querySelector('form');
    const status = this.querySelector('.form-status');
    const button = this.querySelector('button');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if(!form.checkValidity()){ form.reportValidity(); return; }
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Thanks — got it';
      status.textContent = 'Concept form only — no information was sent.';
      setTimeout(() => { button.disabled = false; button.textContent = original; }, 1800);
    });
  }
}
customElements.define('hero-lead', HeroLead);

class RelationshipProcess extends HTMLElement {
  connectedCallback(){
    this.innerHTML = \`
      <section class="process-section" id="model">
        <div class="shell">
          <div class="section-head process-head">
            <div>
              <p class="eyebrow">The Brown Books model</p>
              <h2>A publishing relationship built around the author.</h2>
            </div>
            <p>Brown Books pioneered Relationship Publishing® to combine professional publishing quality with author ownership, stronger economics, and full-market support.</p>
          </div>

          <div class="process-layout">
            <div class="process-steps" role="list">
              \${process.map((step, index) => \`
                <button class="process-step \${index===0?'active':''}" type="button" data-index="\${index}" aria-pressed="\${index===0?'true':'false'}">
                  <span class="step-number">0\${index+1}</span>
                  <span class="step-copy"><strong>\${step.title}</strong><span>\${step.body}</span></span>
                </button>\`).join('')}
            </div>
            <div class="process-media" aria-live="polite">
              <div class="process-media-inner">
                <span class="process-stat">\${process[0].stat}</span>
                <span class="process-detail">\${process[0].detail}</span>
              </div>
            </div>
          </div>
        </div>
      </section>\`;

    const buttons = [...this.querySelectorAll('.process-step')];
    const stat = this.querySelector('.process-stat');
    const detail = this.querySelector('.process-detail');
    const activate = (i) => {
      buttons.forEach((b, index) => {
        const active = i === index;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      stat.textContent = process[i].stat;
      detail.textContent = process[i].detail;
    };
    buttons.forEach((button, i) => {
      button.addEventListener('click', () => activate(i));
      button.addEventListener('focus', () => activate(i));
      button.addEventListener('mouseenter', () => activate(i));
    });
  }
}
customElements.define('relationship-process', RelationshipProcess);

class ServiceTicker extends HTMLElement {
  connectedCallback(){
    const items = ['Editorial','Book design','Production','Distribution','Sales','Licensing','Public relations','Marketing','Social media','Fulfillment'];
    const set = (hidden=false) => \`<div class="ticker-set" \${hidden?'aria-hidden="true"':'role="list"'}>\${items.map(item=>\`<span class="ticker-item" \${hidden?'':'role="listitem"'}><i></i>\${item}</span>\`).join('')}</div>\`;
    this.innerHTML = \`
      <section class="ticker-wrap" id="services" aria-label="Brown Books services">
        <div class="ticker-viewport" tabindex="0" aria-label="Publishing services. Hover or focus to pause.">
          <div class="ticker-track">\${set(false)}\${set(true)}</div>
        </div>
      </section>\`;
  }
}
customElements.define('service-ticker', ServiceTicker);

class BooksStrip extends HTMLElement {
  connectedCallback(){
    this.innerHTML = \`
      <section class="books-section" id="books">
        <div class="shell">
          <div class="section-head compact">
            <div>
              <p class="eyebrow">On the shelf now</p>
              <h2>Fresh from Brown Books.</h2>
            </div>
            <a class="text-link" href="https://www.brownbooks.com/shop/new-releases" target="_blank" rel="noreferrer">Shop new releases →</a>
          </div>
          <div class="book-row">
            \${books.map(book => \`
              <a class="book" href="https://www.brownbooks.com/shop/new-releases" target="_blank" rel="noreferrer">
                <div class="book-art"><img src="\${book.image}" alt="Cover of \${book.title}" /></div>
                <div class="book-meta">
                  <h3>\${book.title}</h3>
                  <p>\${book.subtitle}</p>
                  <span>\${book.price}</span>
                </div>
              </a>\`).join('')}
          </div>
        </div>
      </section>\`;
  }
}
customElements.define('books-strip', BooksStrip);

class ImprintsStrip extends HTMLElement {
  connectedCallback(){
    const imprints = [
      ['Brown Books Publishing Group','Fiction, nonfiction, business, biography, leadership, lifestyle.'],
      ['Brown Books Kids','Picture books, board books, early readers, chapter books and YA.'],
      ['Michael Sampson Books','Storytelling that cultivates the joy of reading in young readers.'],
      ['The Small Press','Top-level publishing services for smaller print runs and personal projects.'],
      ["RADO’s Press",'A nonprofit children’s imprint supporting rescue animals through Operation Kindness.'],
      ['Brown Christian Press','Books intended to inspire, enrich and serve Christian readers.']
    ];
    this.innerHTML = \`
      <section class="imprints-section">
        <div class="shell">
          <div class="section-head compact">
            <div>
              <p class="eyebrow">The publishing family</p>
              <h2>One house. Distinct imprints.</h2>
            </div>
          </div>
          <div class="imprints-grid">
            \${imprints.map((item,index)=>\`<article class="imprint"><span>0\${index+1}</span><h3>\${item[0]}</h3><p>\${item[1]}</p></article>\`).join('')}
          </div>
        </div>
      </section>\`;
  }
}
customElements.define('imprints-strip', ImprintsStrip);

class FaqAccordion extends HTMLElement {
  connectedCallback(){
    const faqs = [
      ['What is hybrid publishing?','A model that combines professional publishing support with author investment, faster timelines, and greater creative and financial control than most traditional routes.'],
      ['Do Brown Books authors keep their rights?','Yes. Brown Books says its authors retain the rights to their work and remain part of the creative process.'],
      ['What does distribution include?','Brown Books supports wholesale and retail distribution with a sales force that presents titles to book buyers and helps keep books available in the market beyond launch.'],
      ['What does an editor bring to a book?','Professional editing strengthens structure, clarity, consistency, readability, and the way an author’s message reaches the reader.']
    ];
    this.innerHTML = \`
      <section class="faq-section" id="faq">
        <div class="shell faq-layout">
          <div class="faq-intro">
            <p class="eyebrow">Questions authors ask</p>
            <h2>Know the model before you choose the publisher.</h2>
            <a class="text-link" href="https://www.brownbooks.com/about-page" target="_blank" rel="noreferrer">Read the full Brown Books FAQ →</a>
          </div>
          <div class="faq-list">
            \${faqs.map((faq,index)=>\`<details \${index===0?'open':''}><summary><span>\${faq[0]}</span><b aria-hidden="true">+</b></summary><p>\${faq[1]}</p></details>\`).join('')}
          </div>
        </div>
      </section>\`;
  }
}
customElements.define('faq-accordion', FaqAccordion);

class CtaBand extends HTMLElement {
  connectedCallback(){
    this.innerHTML = \`
      <section class="cta-band">
        <div class="shell cta-inner">
          <div>
            <p class="eyebrow light">Your book starts with a conversation</p>
            <h2>Bring the idea.<br>Build the book together.</h2>
          </div>
          <div class="cta-actions">
            <a class="button light-button" href="#contact">Talk about your book</a>
            <a class="cta-phone" href="tel:+19723810009">(972) 381-0009</a>
          </div>
        </div>
      </section>\`;
  }
}
customElements.define('cta-band', CtaBand);

class SiteFooter extends HTMLElement {
  connectedCallback(){
    this.innerHTML = \`
      <footer class="site-footer">
        <div class="shell footer-grid">
          <div class="footer-brand">
            <img src="\${LOGO}" alt="Brown Books Publishing Group" />
            <p>Dallas, Texas · Independent publishing since 1994.</p>
          </div>
          <div><strong>Contact</strong><a href="mailto:publishing@brownbooks.com">publishing@brownbooks.com</a><a href="tel:+19723810009">(972) 381-0009</a></div>
          <div><strong>Visit</strong><span>16250 Knoll Trail Drive, Suite 205</span><span>Dallas, Texas 75248</span></div>
          <div><strong>Explore</strong><a href="https://www.brownbooks.com/" target="_blank" rel="noreferrer">Current Brown Books site ↗</a><a href="https://www.brownbooks.com/shop" target="_blank" rel="noreferrer">Shop ↗</a></div>
        </div>
        <div class="shell concept-note">Redesign concept for review · Not the current Brown Books website.</div>
      </footer>\`;
  }
}
customElements.define('site-footer', SiteFooter);

class BrownBooksSite extends HTMLElement {
  connectedCallback(){
    this.innerHTML = \`
      <site-header></site-header>
      <main>
        <hero-lead></hero-lead>
        <relationship-process></relationship-process>
        <service-ticker></service-ticker>
        <books-strip></books-strip>
        <imprints-strip></imprints-strip>
        <faq-accordion></faq-accordion>
        <cta-band></cta-band>
      </main>
      <site-footer></site-footer>\`;
  }
}
customElements.define('bb-site', BrownBooksSite);
