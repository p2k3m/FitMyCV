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

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.frontend_bucket}-oac"
  description                       = "Origin access control for the frontend bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "frontend_bucket" {
  statement {
    sid    = "AllowCloudFrontOACRead"
    effect = "Allow"

    actions = ["s3:GetObject"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    resources = ["${data.aws_s3_bucket.frontend.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }

  statement {
    sid    = "AllowCloudFrontOACList"
    effect = "Allow"

    actions = ["s3:ListBucket"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    resources = [data.aws_s3_bucket.frontend.arn]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = data.aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_bucket.json
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name = data.aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "frontend"

    # When using an origin access control, CloudFront still requires an
    # s3_origin_config block; the origin_access_identity must be empty.
    # https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_distribution#using-an-origin-access-control-with-s3
    s3_origin_config {
      origin_access_identity = ""
    }

    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "frontend"

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

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

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
  }

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.cdn.domain_name
}

output "cloudfront_id" {
  description = "ID of the CloudFront distribution so deployments can trigger cache invalidations"
  value       = aws_cloudfront_distribution.cdn.id
}
