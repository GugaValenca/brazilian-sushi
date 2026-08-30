from django.core.exceptions import ValidationError
from django.db import models

MAX_MENU_IMAGE_SIZE_BYTES = 5 * 1024 * 1024


def validate_menu_image_size(file):
    """Same cap marketing.models.validate_review_photo_size applies to
    review photos -- this field had no size limit at all before, even
    though it's a staff-only upload (AdminMenuItemSerializer), an
    unbounded file is still worth guarding against by mistake or a
    compromised staff account."""
    if file.size > MAX_MENU_IMAGE_SIZE_BYTES:
        raise ValidationError("Image must be 5MB or smaller.")


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class MenuItem(models.Model):
    class Availability(models.TextChoices):
        AVAILABLE = "available", "Available"
        SOLD_OUT = "sold_out", "Sold out"
        HIDDEN = "hidden", "Hidden"

    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=150)
    slug = models.SlugField(unique=True)
    short_description = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    image = models.ImageField(upload_to="menu/", blank=True, null=True, validators=[validate_menu_image_size])
    spicy = models.BooleanField(default=False)
    vegetarian = models.BooleanField(default=False)
    featured = models.BooleanField(default=False)
    allergens = models.CharField(max_length=255, blank=True)
    calories = models.PositiveIntegerField(blank=True, null=True)
    availability = models.CharField(max_length=20, choices=Availability.choices, default=Availability.AVAILABLE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category__sort_order", "name"]

    def __str__(self):
        return self.name


class MenuOptionGroup(models.Model):
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name="option_groups")
    name = models.CharField(max_length=100)
    required = models.BooleanField(default=False)
    min_select = models.PositiveIntegerField(default=0)
    max_select = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.menu_item.name} - {self.name}"


class MenuOption(models.Model):
    group = models.ForeignKey(MenuOptionGroup, on_delete=models.CASCADE, related_name="options")
    name = models.CharField(max_length=100)
    price_delta = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return self.name
