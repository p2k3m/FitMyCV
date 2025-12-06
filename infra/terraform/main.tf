terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "domain_name" {
  type    = string
  default = "fitmycv.example.com"
}

variable "frontend_bucket" {
  description = "Name of the existing frontend bucket"
  type        = string
  default     = "fitmycv-frontend"
}

variable "assets_bucket" {
  description = "Name of the existing assets bucket"
  type        = string
  default     = "fitmycv-assets"
}

data "aws_s3_bucket" "frontend" {
  bucket = var.frontend_bucket
}

data "aws_s3_bucket" "assets" {
  bucket = var.assets_bucket
}

resource "aws_cloudfront_origin_access_identity" "this" {}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name = data.aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "frontend"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.this.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "frontend"

    viewer_protocol_policy = "redirect-to-https"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.cdn.domain_name
}
