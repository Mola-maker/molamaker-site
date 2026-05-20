export default function Nav() {
  return (
    <nav className="top">
      <div className="nav-inner">
        <div className="brand">
          <img
            className="brand-mini"
            src="https://avatars.githubusercontent.com/u/229602071?v=4"
            alt="mola"
          />
          molamaker<span className="dot">.</span>
        </div>
        <div className="nav-links">
          <a href="#about">About</a>
          <a href="#work">Work</a>
          <a href="#writing">Writing</a>
          <a href="#guestbook">Guestbook</a>
          <a href="#contact">Contact</a>
        </div>
      </div>
    </nav>
  );
}
