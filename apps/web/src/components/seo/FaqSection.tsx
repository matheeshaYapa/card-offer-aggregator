import { ChevronDown } from 'lucide-react'
import { FaqStructuredData, type FaqItem } from './StructuredData'

/**
 * Visible FAQ with matching FAQPage markup. Uses <details> so answers are in
 * the HTML (crawlable) but collapsed for visitors.
 */
export default function FaqSection({ title, items }: { title: string; items: FaqItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="faq-section" aria-labelledby="faq-heading">
      <FaqStructuredData items={items} />
      <div className="section-heading">
        <h2 id="faq-heading">{title}</h2>
      </div>
      <div className="faq-list">
        {items.map(({ question, answer }) => (
          <details key={question} className="faq-item">
            <summary>
              <h3>{question}</h3>
              <ChevronDown size={18} aria-hidden="true" className="faq-chevron" />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
