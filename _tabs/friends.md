---
title: 友情链接
icon: fas fa-user-friends
order: 5
---

<style>
.friend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}
a.friend-card.card {
  text-decoration: none !important;
  color: inherit;
  border-bottom: none !important;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}
a.friend-card.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--card-shadow);
  color: inherit;
  border-bottom: none !important;
}
.friend-card .card-body {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
}
.friend-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.friend-icon-fallback {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--sidebar-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  color: var(--text-muted-color);
  flex-shrink: 0;
}
.friend-info {
  min-width: 0;
  flex: 1;
}
.friend-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--heading-color);
  margin: 0;
  line-height: 1.4;
}
.friend-desc {
  font-size: 0.85rem;
  color: var(--text-muted-color);
  margin: 0.3rem 0 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<div class="friend-grid">
  {% for friend in site.data.friends %}
    {% if friend.name and friend.url %}
      <a href="{{ friend.url }}" class="friend-card card" target="_blank" rel="noopener noreferrer">
        <div class="card-body">
          {% if friend.icon %}
            <img src="{{ friend.icon }}" alt="{{ friend.name }}" class="friend-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
            <span class="friend-icon-fallback" style="display:none;"><i class="fas fa-globe"></i></span>
          {% else %}
            <span class="friend-icon-fallback"><i class="fas fa-globe"></i></span>
          {% endif %}
          <div class="friend-info">
            <div class="friend-name">{{ friend.name }}</div>
            {% if friend.description %}
              <div class="friend-desc">{{ friend.description }}</div>
            {% endif %}
          </div>
        </div>
      </a>
    {% endif %}
  {% endfor %}
</div>
