export default function Newsletter() {
  return (
    <section>
      <div className="wrapper">
        <div className="features-list">
          <div className="heading-md" style={{ marginBottom: 8 }}>Be the first to know</div>
          <p className="body-md">Join the waitlist for early access to new features, desktop releases, and the Kode Gateway.</p>
          <form
            className="newsletter-form"
            onSubmit={e => { e.preventDefault(); alert('Subscribed!') }}
          >
            <input
              type="email"
              placeholder="your@email.com"
              required
            />
            <button type="submit" className="btn-primary">Subscribe</button>
          </form>
        </div>
      </div>
    </section>
  )
}
