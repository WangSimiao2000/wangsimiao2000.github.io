---
icon: fas fa-user-friends
order: 5
---

<style>
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.friend-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border-color);
  border-radius: 0.75rem;
  padding: 1.25rem;
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.friend-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-icon img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.default-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  font-size: 1.5rem;
  color: var(--text-color);
  opacity: 0.6;
}

.card-text h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.card-text p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--text-color);
  opacity: 0.75;
}
</style>

<div class="card-grid">
  {% for friend in site.data.friends %}
    {% if friend.name and friend.url %}
      <a href="{{ friend.url }}" class="friend-card" target="_blank" rel="noopener noreferrer">
        <div class="card-icon">
          {% if friend.icon %}
            <img src="{{ friend.icon }}" alt="{{ friend.name }}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
            <span class="default-icon" style="display:none;"><i class="fas fa-globe"></i></span>
          {% else %}
            <span class="default-icon"><i class="fas fa-globe"></i></span>
          {% endif %}
        </div>
        <div class="card-text">
          <h3>{{ friend.name }}</h3>
          {% if friend.description %}
            <p>{{ friend.description }}</p>
          {% endif %}
        </div>
      </a>
    {% endif %}
  {% endfor %}
</div>
