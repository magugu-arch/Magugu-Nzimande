import type { Article } from '@/content/journal';

/** Renders structured article/legal bodies as semantic HTML (h2, p, ul). */
export function RichText({ body, className }: { body: Article['body']; className?: string }) {
  return (
    <div className={`prose ${className ?? ''}`}>
      {body.map((block, i) => {
        if (block.type === 'h2') return <h2 key={i}>{block.text}</h2>;
        if (block.type === 'ul')
          return (
            <ul key={i}>
              {(block.items ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        return <p key={i}>{block.text}</p>;
      })}
    </div>
  );
}
