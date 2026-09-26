import { Hero } from './components/Hero';
import { Nav } from './components/Nav';
import { About, Contact, Expertise, Footer, Quest, VisualProof } from './components/Sections';

export default function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Quest />
        <Expertise />
        <About />
        <VisualProof />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
