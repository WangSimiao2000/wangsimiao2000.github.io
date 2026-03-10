---
title: 友情链接
icon: fas fa-user-friends
order: 5
---

<style>
.friend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.friend-grid .card {
  transition: transform 0.2s, box-shadow 0.2s;
}
.friend-grid .card:hover {
  transform: translateY(-2px);
  box-shadow: var(--card-shadow);
}
.friend-grid .card .card-body a {
  text-decoration: none;
  color: inherit;
  border-bottom: none !important;
}
.friend-grid .card .card-body a:hover {
  color: inherit;
  border-bottom: none !important;
}
.friend-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.friend-icon-fallback {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  opacity: 0.6;
  flex-shrink: 0;
}
.friend-name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}
.friend-desc {
  font-size: 0.85rem;
  margin: 0.25rem 0 0;
  opacity: 0.75;
}
</style>

<div class="friend-grid">
  {% for friend in site.data.friends %}
    {% if friend.name and friend.url %}
      <div class="card">
        <div class="card-body p-0">
          <a href="{{ friend.url }}" class="d-flex align-items-center p-0" style="padding: 1.25rem !important;" target="_blank" rel="noopener noreferrer">
            {% if friend.icon %}
              <img src="{{ friend.icon }}" alt="{{ friend.name }}" class="friend-avatar me-3" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
              <span class="friend-icon-fallback me-3" style="display:none;"><i class="fas fa-globe"></i></span>
            {% else %}
              <span class="friend-icon-fallback me-3"><i class="fas fa-globe"></i></span>
            {% endif %}
            <div>
              <div class="friend-name">{{ friend.name }}</div>
              {% if friend.description %}
                <div class="friend-desc">{{ friend.description }}</div>
              {% endif %}
            </div>
          </a>
        </div>
      </div>
    {% endif %}
  {% endfor %}
</div>
